import { extractPptxText, orderDecks } from "@/lib/pptx";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File);

    if (files.length === 0) {
      return Response.json({ error: "Upload at least one PPTX file." }, { status: 400 });
    }

    const extracted = await Promise.all(
      files.map(async (file) => extractPptxText(file.name, await file.arrayBuffer())),
    );

    // Order by the sequence inferred from each filename (lecture/chapter/week
    // numbers) so generation and the raw export follow the real lecture order.
    const decks = orderDecks(extracted);

    return Response.json({ decks });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}
