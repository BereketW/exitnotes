import Link from "next/link";
import { courses } from "@/lib/courses";
import { listNotes } from "@/lib/notes-store";

export const dynamic = "force-dynamic";

export default function Home() {
  const notes = listNotes();

  return (
    <main className="min-h-screen bg-[#f6f2e8] text-[#17130f]">
      <section className="border-b border-[#17130f]/15 bg-[#fdf9ef]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
          <nav className="flex items-center justify-between gap-4">
            <Link href="/" className="text-sm font-black uppercase tracking-[0.28em]">
              ExitNotes
            </Link>
            <div className="hidden items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#635a4d] sm:flex">
              PPTX
              <span className="h-px w-8 bg-[#d9482e]" />
              Clean MD
              <span className="h-px w-8 bg-[#d9482e]" />
              Notes
            </div>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-[#d9482e]">
                Lecture compression desk
              </p>
              <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-normal sm:text-7xl">
                Turn crowded slide decks into exam-ready short notes.
              </h1>
            </div>
            <p className="max-w-xl text-lg leading-8 text-[#4d463e]">
              Upload one or many PPTX files per course, extract slide text,
              strip noise, compress repeated topics, then generate
              blueprint-aware notes that classmates can open or download.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_340px] lg:px-10">
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-black">Courses</h2>
            <span className="text-sm font-bold text-[#635a4d]">
              {courses.length} course workspaces
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course, index) => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="group min-h-44 border border-[#17130f]/15 bg-white p-5 shadow-[6px_6px_0_#17130f] transition-transform hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-[#d9482e]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="rounded-full border border-[#17130f]/20 px-3 py-1 text-xs font-bold">
                    Open
                  </span>
                </div>
                <h3 className="mt-8 text-2xl font-black leading-tight">
                  {course.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#635a4d]">
                  {course.description}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <aside className="border border-[#17130f]/15 bg-[#17130f] p-5 text-[#fdf9ef] shadow-[6px_6px_0_#d9482e]">
          <h2 className="text-xl font-black">Recent notes</h2>
          <div className="mt-4 space-y-3">
            {notes.length === 0 ? (
              <p className="text-sm leading-6 text-[#d8cec0]">
                Generated notes will appear here while the app process is
                running.
              </p>
            ) : (
              notes.slice(0, 6).map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="block border border-[#fdf9ef]/15 p-3 hover:bg-[#fdf9ef]/10"
                >
                  <p className="font-bold">{note.title}</p>
                  <p className="mt-1 text-xs text-[#d8cec0]">
                    {note.courseTitle} - {note.deckCount} deck
                    {note.deckCount === 1 ? "" : "s"}
                  </p>
                </Link>
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
