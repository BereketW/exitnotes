// Provider abstraction: prefers FreeModel (Claude, OpenAI-compatible) when
// FREEMODEL_API_KEY is set, then Gemini, then no provider (callers fall back
// to rule-based output).

const FREEMODEL_API_URL = "https://api.freemodel.dev/v1/chat/completions";
const FREEMODEL_DEFAULT_MODEL = "claude-sonnet-4-6";

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

export type Provider = "freemodel" | "gemini" | "none";

export type RawCompletion = {
  text: string;
  provider: Provider;
  model: string;
  finishReason: string | null;
  promptTokens: number | null;
  outputTokens: number | null;
  thoughtTokens: number | null;
  blockReason: string | null;
};

export type GenerationDiagnostics = {
  provider: Provider;
  model: string;
  usedFallback: boolean;
  finishReason: string | null;
  promptChars: number;
  outputChars: number;
  outputLines: number;
  promptTokens: number | null;
  outputTokens: number | null;
  thoughtTokens: number | null;
  truncated: boolean;
  note: string | null;
};

export function activeProvider(): Provider {
  if (process.env.FREEMODEL_API_KEY) return "freemodel";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "none";
}

/**
 * Runs a single-prompt completion against the active provider.
 * Returns null when no provider is configured.
 */
export async function runModel(
  prompt: string,
  opts: { maxTokens?: number; label?: string } = {},
): Promise<RawCompletion | null> {
  const provider = activeProvider();
  const maxTokens = opts.maxTokens ?? 8192;
  const label = opts.label ?? "model";

  console.log(
    `[${label}] provider=${provider} promptChars=${prompt.length} maxTokens=${maxTokens}`,
  );

  if (provider === "freemodel") {
    return callFreeModel(prompt, maxTokens, label);
  }
  if (provider === "gemini") {
    return callGemini(prompt, maxTokens, label);
  }
  return null;
}

async function callFreeModel(
  prompt: string,
  maxTokens: number,
  label: string,
): Promise<RawCompletion> {
  const model = process.env.FREEMODEL_MODEL ?? FREEMODEL_DEFAULT_MODEL;
  const start = Date.now();

  const response = await fetch(FREEMODEL_API_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.FREEMODEL_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    console.error(`[${label}] freemodel HTTP ${response.status}: ${message.slice(0, 500)}`);
    throw new Error(`FreeModel request failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string };
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const choice = payload.choices?.[0];
  const text = (choice?.message?.content ?? "").trim();
  const finishReason = choice?.finish_reason ?? null;

  console.log(
    `[${label}] freemodel ${Date.now() - start}ms model=${model} finishReason=${finishReason} ` +
      `promptTokens=${payload.usage?.prompt_tokens ?? "?"} outputTokens=${payload.usage?.completion_tokens ?? "?"} ` +
      `outputChars=${text.length}`,
  );

  return {
    text,
    provider: "freemodel",
    model,
    finishReason,
    promptTokens: payload.usage?.prompt_tokens ?? null,
    outputTokens: payload.usage?.completion_tokens ?? null,
    thoughtTokens: null,
    blockReason: null,
  };
}

async function callGemini(
  prompt: string,
  maxTokens: number,
  label: string,
): Promise<RawCompletion> {
  const model = process.env.GEMINI_MODEL ?? GEMINI_DEFAULT_MODEL;
  const start = Date.now();

  const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY as string,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: maxTokens,
        // gemini-2.5-* are thinking models; left on, "thoughts" silently
        // consume the output-token budget and the output gets truncated.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    console.error(`[${label}] gemini HTTP ${response.status}: ${message.slice(0, 500)}`);
    throw new Error(`Gemini request failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
    };
    promptFeedback?: { blockReason?: string };
  };

  const candidate = payload.candidates?.[0];
  const text =
    candidate?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";
  const finishReason = candidate?.finishReason ?? null;
  const usage = payload.usageMetadata;

  console.log(
    `[${label}] gemini ${Date.now() - start}ms model=${model} finishReason=${finishReason} ` +
      `promptTokens=${usage?.promptTokenCount ?? "?"} outputTokens=${usage?.candidatesTokenCount ?? "?"} ` +
      `thoughtTokens=${usage?.thoughtsTokenCount ?? 0} outputChars=${text.length} ` +
      `blockReason=${payload.promptFeedback?.blockReason ?? "none"}`,
  );

  return {
    text,
    provider: "gemini",
    model,
    finishReason,
    promptTokens: usage?.promptTokenCount ?? null,
    outputTokens: usage?.candidatesTokenCount ?? null,
    thoughtTokens: usage?.thoughtsTokenCount ?? null,
    blockReason: payload.promptFeedback?.blockReason ?? null,
  };
}

/** Builds a diagnostics object from a completion (or a fallback). */
export function buildDiagnostics(args: {
  completion: RawCompletion | null;
  promptChars: number;
  output: string;
  usedFallback: boolean;
  note: string | null;
}): GenerationDiagnostics {
  const { completion, promptChars, output, usedFallback, note } = args;
  return {
    provider: completion?.provider ?? "none",
    model: completion?.model ?? "rule-based",
    usedFallback,
    finishReason: completion?.finishReason ?? null,
    promptChars,
    outputChars: output.length,
    outputLines: output.split("\n").length,
    promptTokens: completion?.promptTokens ?? null,
    outputTokens: completion?.outputTokens ?? null,
    thoughtTokens: completion?.thoughtTokens ?? null,
    truncated:
      completion?.finishReason === "MAX_TOKENS" ||
      completion?.finishReason === "length",
    note,
  };
}
