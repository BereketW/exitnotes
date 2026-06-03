import { listNotes } from "@/lib/notes-store";

export async function GET() {
  return Response.json({ notes: listNotes() });
}
