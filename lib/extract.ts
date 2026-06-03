import { extractPptxText } from "@/lib/pptx";

// Extracts plain text from a blueprint/lecture document by file extension.
// Supports .pptx (reuses the slide extractor), .pdf (pdf-parse), and .txt/.md.
export async function extractDocumentText(
  fileName: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";

  if (extension === "pptx") {
    const deck = extractPptxText(fileName, bytes);
    return deck.slides
      .map((slide) => `Slide ${slide.slideNumber}\n${slide.text}`)
      .join("\n\n")
      .trim();
  }

  if (extension === "txt" || extension === "md" || extension === "markdown") {
    return Buffer.from(bytes).toString("utf8").trim();
  }

  if (extension === "pdf") {
    // pdf-parse is CommonJS; import the lib entry directly (index.js runs
    // debug code that reads a test file and crashes when bundled). Lazy import
    // keeps it off the client path.
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (
      data: Buffer,
    ) => Promise<{ text: string }>;
    const result = await pdfParse(Buffer.from(bytes));
    const text = result.text.trim();
    if (!text) {
      throw new Error(
        "No text found in the PDF. It may be a scanned/image-only document.",
      );
    }
    return text;
  }

  throw new Error(
    `Unsupported blueprint format ".${extension}". Use PPTX, PDF, TXT, or MD.`,
  );
}
