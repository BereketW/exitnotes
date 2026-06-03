const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 8192;

export type GenerationDiagnostics = {
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

export type GenerationResult = {
  markdown: string;
  diagnostics: GenerationDiagnostics;
};

export async function generateNotes(input: {
  courseTitle: string;
  blueprint: string;
  compressedMarkdown: string;
}): Promise<GenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const prompt = buildPrompt(input);

  console.log(
    `[generate] course="${input.courseTitle}" promptChars=${prompt.length} compressedChars=${input.compressedMarkdown.length} model=${model} key=${apiKey ? "present" : "missing"}`,
  );

  if (!apiKey) {
    const markdown = generateFallbackNotes(input, "Gemini is not configured. Add `GEMINI_API_KEY` to generate richer blueprint-targeted notes.");
    console.log("[generate] no API key -> rule-based fallback");
    return {
      markdown,
      diagnostics: diag(model, true, null, prompt.length, markdown, undefined, "No GEMINI_API_KEY set; used rule-based fallback."),
    };
  }

  const requestStart = Date.now();
  const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        // gemini-2.5-* are thinking models; left on, "thoughts" silently
        // consume the output-token budget and the notes get truncated.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    console.error(`[generate] HTTP ${response.status}: ${message.slice(0, 500)}`);
    throw new Error(`Gemini generation failed (${response.status}): ${message}`);
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
  const finishReason = candidate?.finishReason ?? null;
  const usage = payload.usageMetadata;
  const text =
    candidate?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  console.log(
    `[generate] ${Date.now() - requestStart}ms finishReason=${finishReason} ` +
      `promptTokens=${usage?.promptTokenCount ?? "?"} outputTokens=${usage?.candidatesTokenCount ?? "?"} ` +
      `thoughtTokens=${usage?.thoughtsTokenCount ?? 0} outputChars=${text.length} ` +
      `blockReason=${payload.promptFeedback?.blockReason ?? "none"}`,
  );

  if (!text) {
    const reason = payload.promptFeedback?.blockReason
      ? `Response was blocked (${payload.promptFeedback.blockReason}).`
      : `Model returned no text (finishReason=${finishReason}).`;
    const markdown = generateFallbackNotes(input, reason);
    console.warn(`[generate] empty model output -> fallback. ${reason}`);
    return {
      markdown,
      diagnostics: diag(model, true, finishReason, prompt.length, markdown, usage, reason),
    };
  }

  const truncated = finishReason === "MAX_TOKENS";
  return {
    markdown: text,
    diagnostics: diag(
      model,
      false,
      finishReason,
      prompt.length,
      text,
      usage,
      truncated ? "Output hit the token limit and may be cut off." : null,
    ),
  };
}

function diag(
  model: string,
  usedFallback: boolean,
  finishReason: string | null,
  promptChars: number,
  output: string,
  usage:
    | {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        thoughtsTokenCount?: number;
      }
    | undefined,
  note: string | null,
): GenerationDiagnostics {
  return {
    model,
    usedFallback,
    finishReason,
    promptChars,
    outputChars: output.length,
    outputLines: output.split("\n").length,
    promptTokens: usage?.promptTokenCount ?? null,
    outputTokens: usage?.candidatesTokenCount ?? null,
    thoughtTokens: usage?.thoughtsTokenCount ?? null,
    truncated: finishReason === "MAX_TOKENS",
    note,
  };
}

function buildPrompt(input: {
  courseTitle: string;
  blueprint: string;
  compressedMarkdown: string;
}) {
  return `Create concise exam short notes for ${input.courseTitle}.

Blueprint or exam focus:
${input.blueprint || "No blueprint was provided. Prioritize definitions, core ideas, formulas, algorithms, differences, and likely short-answer points."}

Rules:
- Use Markdown.
- Keep it short but complete.
- Group by topic.
- Prefer direct exam language over lecture narration.
- Include definitions, key steps, formulas, comparisons, and common mistakes.
- Do not invent facts that are not supported by the lecture extract.

Compressed lecture extract:
${input.compressedMarkdown}`;
}

function generateFallbackNotes(
  input: {
    courseTitle: string;
    blueprint: string;
    compressedMarkdown: string;
  },
  statusMessage: string,
) {
  const lines = input.compressedMarkdown
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .slice(0, 200);

  return [
    `# ${input.courseTitle} Short Notes`,
    "",
    "## Exam focus",
    input.blueprint.trim() || "Review the high-frequency definitions, steps, formulas, and comparisons from the lecture slides.",
    "",
    "## Condensed lecture points",
    ...lines,
    "",
    "## Generation status",
    statusMessage,
  ].join("\n");
}
