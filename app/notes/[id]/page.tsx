import Link from "next/link";
import { notFound } from "next/navigation";
import { getNote } from "@/lib/notes-store";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = getNote(id);

  if (!note) {
    notFound();
  }

  const downloadHref = `data:text/markdown;charset=utf-8,${encodeURIComponent(note.markdown)}`;

  return (
    <main className="min-h-screen bg-[#f6f2e8] text-[#17130f]">
      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8 lg:px-10">
        <nav className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-black uppercase tracking-[0.24em]">
            ExitNotes
          </Link>
          <a
            href={downloadHref}
            download={`${note.courseId}-short-notes.md`}
            className="bg-[#17130f] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white"
          >
            Download MD
          </a>
        </nav>

        <header className="mt-8 border border-[#17130f]/15 bg-white p-5 shadow-[8px_8px_0_#17130f]">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#d9482e]">
            {note.courseTitle}
          </p>
          <h1 className="mt-3 text-4xl font-black leading-none sm:text-6xl">
            {note.title}
          </h1>
          <div className="mt-5 grid gap-3 text-sm font-bold text-[#635a4d] sm:grid-cols-3">
            <span>{note.deckCount} deck{note.deckCount === 1 ? "" : "s"}</span>
            <span>{note.slideCount} slides</span>
            <span>{new Date(note.createdAt).toLocaleString()}</span>
          </div>
        </header>

        {note.blueprintSections && note.blueprintSections.length > 0 && (
          <section className="mt-8 border border-[#17130f]/15 bg-white p-5 shadow-[6px_6px_0_#d9482e]">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#d9482e]">
              Key exam blueprint
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {note.blueprintSections.map((section, index) => (
                <div
                  key={`${section.title}-${index}`}
                  className="border border-[#17130f]/15 bg-[#fdf9ef] p-3"
                >
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-black">
                      {index + 1}. {section.title || "Untitled section"}
                    </span>
                    {section.weight && (
                      <span className="shrink-0 text-xs font-bold text-[#d9482e]">
                        {section.weight}
                      </span>
                    )}
                  </p>
                  {section.keyPoints.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#4d463e]">
                      {section.keyPoints.map((point, pointIndex) => (
                        <li key={pointIndex}>{point}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <article className="prose-notes mt-8 border border-[#17130f]/15 bg-[#fdf9ef] p-5">
          {renderMarkdown(note.markdown)}
        </article>
      </div>
    </main>
  );
}

function renderMarkdown(markdown: string) {
  return markdown.split("\n").map((line, index) => {
    if (line.startsWith("# ")) {
      return <h1 key={index}>{line.slice(2)}</h1>;
    }
    if (line.startsWith("## ")) {
      return <h2 key={index}>{line.slice(3)}</h2>;
    }
    if (line.startsWith("### ")) {
      return <h3 key={index}>{line.slice(4)}</h3>;
    }
    if (line.startsWith("- ")) {
      return <li key={index}>{line.slice(2)}</li>;
    }
    if (!line.trim()) {
      return <div key={index} className="h-3" />;
    }
    return <p key={index}>{line}</p>;
  });
}
