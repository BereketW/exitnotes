import { compressDecks } from "@/lib/compress";
import type { ExtractedDeck } from "@/lib/pptx";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { decks?: ExtractedDeck[] };

    if (!body.decks || body.decks.length === 0) {
      return Response.json({ error: "No decks supplied." }, { status: 400 });
    }

    const merged = compressDecks(body.decks);
    return Response.json({ merged });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Merge failed." },
      { status: 500 },
    );
  }
}
