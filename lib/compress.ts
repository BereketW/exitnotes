import type { ExtractedDeck } from "@/lib/pptx";

export type CompressionResult = {
  markdown: string;
  totalSlides: number;
  retainedLines: number;
  removedLines: number;
};

const noisePatterns = [
  /^slide\s*\d+$/i,
  /^thank\s+you[!.]?$/i,
  /^questions[?.]?$/i,
  /^click\s+(next|to|here)/i,
  /^lecture\s*\d+$/i,
  /^(department|faculty|school|university)\b/i,
  /^(date|instructor|professor|prepared by)\b/i,
  /^page\s*\d+\s*(of\s*\d+)?$/i,
];

export function compressDecks(decks: ExtractedDeck[]) {
  const seen = new Set<string>();
  let retainedLines = 0;
  let removedLines = 0;

  const deckMarkdown = decks.map((deck) => {
    const topicLines: string[] = [];

    for (const slide of deck.slides) {
      const cleanLines = slide.text
        .split(/\n+/)
        .map(cleanLine)
        .filter((line) => {
          if (!line) {
            removedLines += 1;
            return false;
          }

          if (noisePatterns.some((pattern) => pattern.test(line))) {
            removedLines += 1;
            return false;
          }

          const key = normalizeForDedupe(line);
          if (seen.has(key)) {
            removedLines += 1;
            return false;
          }

          seen.add(key);
          retainedLines += 1;
          return true;
        })
        .slice(0, 10);

      if (cleanLines.length > 0) {
        topicLines.push(
          `### Slide ${slide.slideNumber}`,
          ...cleanLines.map((line) => `- ${line}`),
          "",
        );
      }
    }

    return [`## ${deck.fileName}`, ...topicLines].join("\n").trim();
  });

  return {
    markdown: deckMarkdown.filter(Boolean).join("\n\n"),
    totalSlides: decks.reduce((total, deck) => total + deck.slides.length, 0),
    retainedLines,
    removedLines,
  } satisfies CompressionResult;
}

function cleanLine(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\-*•\d.)\s]+/, "")
    .trim();
}

function normalizeForDedupe(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
