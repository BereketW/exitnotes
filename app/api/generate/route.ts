import { generateNotes } from "@/lib/gemini";
import { compressDecks } from "@/lib/compress";
import { getCourse } from "@/lib/courses";
import { saveNote } from "@/lib/notes-store";
import type { ExtractedDeck } from "@/lib/pptx";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      courseId?: string;
      blueprint?: string;
      decks?: ExtractedDeck[];
    };

    if (!body.courseId) {
      return Response.json({ error: "Missing course id." }, { status: 400 });
    }

    if (!body.decks || body.decks.length === 0) {
      return Response.json({ error: "Upload PPTX files before generating." }, { status: 400 });
    }

    const course = getCourse(body.courseId);
    if (!course) {
      return Response.json({ error: "Unknown course." }, { status: 404 });
    }

    const compressed = compressDecks(body.decks);
    const markdown = await generateNotes({
      courseTitle: course.title,
      blueprint: body.blueprint ?? "",
      compressedMarkdown: compressed.markdown,
    });

    const note = saveNote({
      id: crypto.randomUUID(),
      courseId: course.id,
      courseTitle: course.title,
      title: `${course.title} Short Notes`,
      markdown,
      compressedMarkdown: compressed.markdown,
      blueprint: body.blueprint ?? "",
      deckCount: body.decks.length,
      slideCount: compressed.totalSlides,
      sourceFiles: body.decks.map((deck) => deck.fileName),
      createdAt: new Date().toISOString(),
    });

    return Response.json({
      note,
      stats: {
        totalSlides: compressed.totalSlides,
        retainedLines: compressed.retainedLines,
        removedLines: compressed.removedLines,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Generation failed." },
      { status: 500 },
    );
  }
}
