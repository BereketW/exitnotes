import {
  buildDiagnostics,
  runModel,
  type GenerationDiagnostics,
} from "@/lib/llm";

export type BlueprintSection = {
  title: string;
  keyPoints: string[];
  weight?: string;
};

export type NoteGenerationInput = {
  courseTitle: string;
  blueprintText: string;
  blueprintSections?: BlueprintSection[];
  compressedMarkdown: string;
};

export type NoteGenerationResult = {
  markdown: string;
  diagnostics: GenerationDiagnostics;
};

export type BlueprintAnalysisResult = {
  sections: BlueprintSection[];
  diagnostics: GenerationDiagnostics;
};

// ---------------------------------------------------------------------------
// Step 1: analyze the exit-exam blueprint into key points per section.
// ---------------------------------------------------------------------------

export async function analyzeBlueprint(input: {
  courseTitle: string;
  blueprintText: string;
  compressedMarkdown: string;
}): Promise<BlueprintAnalysisResult> {
  const prompt = buildAnalyzePrompt(input);
  const completion = await runModel(prompt, {
    maxTokens: 4096,
    label: "blueprint",
  });

  if (!completion || !completion.text) {
    const sections = fallbackSections(input.blueprintText);
    return {
      sections,
      diagnostics: buildDiagnostics({
        completion,
        promptChars: prompt.length,
        output: JSON.stringify(sections),
        usedFallback: true,
        note: completion
          ? "Model returned no usable text; derived sections from the blueprint text."
          : "No AI provider configured; derived sections from the blueprint text.",
      }),
    };
  }

  const parsed = parseSections(completion.text);
  if (parsed.length === 0) {
    const sections = fallbackSections(input.blueprintText);
    return {
      sections,
      diagnostics: buildDiagnostics({
        completion,
        promptChars: prompt.length,
        output: completion.text,
        usedFallback: true,
        note: "Could not parse model JSON; derived sections from the blueprint text.",
      }),
    };
  }

  return {
    sections: parsed,
    diagnostics: buildDiagnostics({
      completion,
      promptChars: prompt.length,
      output: completion.text,
      usedFallback: false,
      note: completion.finishReason === "MAX_TOKENS" || completion.finishReason === "length"
        ? "Analysis hit the token limit and may be incomplete."
        : null,
    }),
  };
}

function buildAnalyzePrompt(input: {
  courseTitle: string;
  blueprintText: string;
  compressedMarkdown: string;
}) {
  return `You are preparing for the ${input.courseTitle} exit exam.

Read the exam blueprint below and break it into its sections/units. For each
section, list the key exam points a student must master (topics, definitions,
formulas, skills, likely question types). If the blueprint states weights or
marks per section, capture them.

Return ONLY valid JSON in exactly this shape, no prose, no markdown fences:
{"sections":[{"title":"...","weight":"...","keyPoints":["...","..."]}]}
- "weight" is optional; omit or use "" if unknown.
- Keep keyPoints concise and exam-focused.
- Base sections on the blueprint; use the lecture extract only to sharpen wording.

Exam blueprint:
${input.blueprintText || "(none provided)"}

Lecture extract (context only):
${input.compressedMarkdown.slice(0, 12000)}`;
}

// Tolerant JSON extraction: strips code fences and grabs the outermost object.
function parseSections(text: string): BlueprintSection[] {
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    body = fence[1].trim();
  }
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return [];
  }

  try {
    const data = JSON.parse(body.slice(start, end + 1)) as {
      sections?: Array<{
        title?: string;
        weight?: string;
        keyPoints?: unknown;
      }>;
    };
    if (!Array.isArray(data.sections)) {
      return [];
    }
    return data.sections
      .map((section) => ({
        title: String(section.title ?? "").trim(),
        weight: section.weight ? String(section.weight).trim() : undefined,
        keyPoints: Array.isArray(section.keyPoints)
          ? section.keyPoints.map((point) => String(point).trim()).filter(Boolean)
          : [],
      }))
      .filter((section) => section.title || section.keyPoints.length > 0);
  } catch {
    return [];
  }
}

// Rule-based fallback: split blueprint text into sections by heading-like lines.
function fallbackSections(blueprintText: string): BlueprintSection[] {
  const lines = blueprintText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const sections: BlueprintSection[] = [];
  let current: BlueprintSection | null = null;

  const isHeading = (line: string) =>
    /^(#{1,6}\s+|section\b|unit\b|chapter\b|part\b|module\b|topic\b|\d+[.)]\s)/i.test(
      line,
    ) || (line.length <= 80 && !/[.;,]$/.test(line) && /[a-z]/i.test(line) && line === line.replace(/^[-*•]\s*/, ""));

  for (const line of lines) {
    const bullet = line.replace(/^[-*•]\s*/, "");
    if (isHeading(line) && !/^[-*•]/.test(line)) {
      current = { title: line.replace(/^#{1,6}\s+/, "").trim(), keyPoints: [] };
      sections.push(current);
    } else if (current) {
      current.keyPoints.push(bullet);
    } else {
      current = { title: "Exam topics", keyPoints: [bullet] };
      sections.push(current);
    }
  }

  return sections.filter((s) => s.title || s.keyPoints.length > 0).slice(0, 30);
}

// ---------------------------------------------------------------------------
// Step 2: generate the short notes, targeted to the reviewed blueprint.
// ---------------------------------------------------------------------------

export async function generateNotes(
  input: NoteGenerationInput,
): Promise<NoteGenerationResult> {
  const prompt = buildNotesPrompt(input);
  const completion = await runModel(prompt, {
    maxTokens: 8192,
    label: "generate",
  });

  if (!completion || !completion.text) {
    const reason = completion?.blockReason
      ? `Response was blocked (${completion.blockReason}).`
      : completion
        ? `Model returned no text (finishReason=${completion.finishReason}).`
        : "No AI provider configured; used rule-based fallback.";
    const markdown = fallbackNotes(input, reason);
    return {
      markdown,
      diagnostics: buildDiagnostics({
        completion,
        promptChars: prompt.length,
        output: markdown,
        usedFallback: true,
        note: reason,
      }),
    };
  }

  const truncated =
    completion.finishReason === "MAX_TOKENS" ||
    completion.finishReason === "length";
  return {
    markdown: completion.text,
    diagnostics: buildDiagnostics({
      completion,
      promptChars: prompt.length,
      output: completion.text,
      usedFallback: false,
      note: truncated ? "Output hit the token limit and may be cut off." : null,
    }),
  };
}

function buildNotesPrompt(input: NoteGenerationInput) {
  const blueprint = renderBlueprintForPrompt(input);

  return `Create concise exam short notes for ${input.courseTitle}.

${blueprint}

Rules:
- Use Markdown.
- Organize the notes to match the blueprint sections above, in order.
- Cover every key exam point listed; do not skip a section.
- Keep it short but complete: definitions, key steps, formulas, comparisons, common mistakes.
- Prefer direct exam language over lecture narration.
- Do not invent facts that are not supported by the lecture extract.

Compressed lecture extract:
${input.compressedMarkdown}`;
}

function renderBlueprintForPrompt(input: NoteGenerationInput) {
  if (input.blueprintSections && input.blueprintSections.length > 0) {
    const rendered = input.blueprintSections
      .map((section) => {
        const heading = section.weight
          ? `### ${section.title} (${section.weight})`
          : `### ${section.title}`;
        const points = section.keyPoints.map((point) => `- ${point}`).join("\n");
        return `${heading}\n${points}`;
      })
      .join("\n\n");
    return `Exam blueprint (target the notes to exactly these sections and key points):\n${rendered}`;
  }

  return `Blueprint or exam focus:
${input.blueprintText || "No blueprint was provided. Prioritize definitions, core ideas, formulas, algorithms, differences, and likely short-answer points."}`;
}

function fallbackNotes(input: NoteGenerationInput, statusMessage: string) {
  const lines = input.compressedMarkdown
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .slice(0, 200);

  const blueprintBlock =
    input.blueprintSections && input.blueprintSections.length > 0
      ? input.blueprintSections
          .map(
            (section) =>
              `### ${section.title}\n${section.keyPoints
                .map((point) => `- ${point}`)
                .join("\n")}`,
          )
          .join("\n\n")
      : input.blueprintText.trim() ||
        "Review the high-frequency definitions, steps, formulas, and comparisons from the lecture slides.";

  return [
    `# ${input.courseTitle} Short Notes`,
    "",
    "## Exam focus",
    blueprintBlock,
    "",
    "## Condensed lecture points",
    ...lines,
    "",
    "## Generation status",
    statusMessage,
  ].join("\n");
}
