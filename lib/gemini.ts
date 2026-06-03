const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";

export async function generateNotes(input: {
  courseTitle: string;
  blueprint: string;
  compressedMarkdown: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return generateFallbackNotes(input);
  }

  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const response = await fetch(
    `${GEMINI_API_BASE}/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(input) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 3500,
        },
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini generation failed: ${message}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() || generateFallbackNotes(input)
  );
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

function generateFallbackNotes(input: {
  courseTitle: string;
  blueprint: string;
  compressedMarkdown: string;
}) {
  const lines = input.compressedMarkdown
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .slice(0, 80);

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
    "Gemini is not configured. Add `GEMINI_API_KEY` to generate richer blueprint-targeted notes.",
  ].join("\n");
}
