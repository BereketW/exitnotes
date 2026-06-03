export type Note = {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  markdown: string;
  compressedMarkdown: string;
  blueprint: string;
  deckCount: number;
  slideCount: number;
  sourceFiles: string[];
  createdAt: string;
};

const globalForNotes = globalThis as typeof globalThis & {
  exitNotesStore?: Map<string, Note>;
};

const notes = globalForNotes.exitNotesStore ?? new Map<string, Note>();
globalForNotes.exitNotesStore = notes;

export function saveNote(note: Note) {
  notes.set(note.id, note);
  return note;
}

export function getNote(id: string) {
  return notes.get(id);
}

export function listNotes() {
  return Array.from(notes.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
