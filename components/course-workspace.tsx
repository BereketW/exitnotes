"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Course } from "@/lib/courses";
import type { ExtractedDeck } from "@/lib/pptx";

type UploadState = "idle" | "uploading" | "ready" | "generating" | "error";

export default function CourseWorkspace({ course }: { course: Course }) {
  const router = useRouter();
  const [status, setStatus] = useState<UploadState>("idle");
  const [decks, setDecks] = useState<ExtractedDeck[]>([]);
  const [blueprint, setBlueprint] = useState("");
  const [error, setError] = useState("");
  const [stats, setStats] = useState<{
    totalSlides: number;
    retainedLines: number;
    removedLines: number;
  } | null>(null);

  const slideCount = useMemo(
    () => decks.reduce((total, deck) => total + deck.slides.length, 0),
    [decks],
  );

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setStatus("uploading");
    setError("");
    setStats(null);

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Upload failed.");
      setStatus("error");
      return;
    }

    setDecks(payload.decks);
    setStatus("ready");
  }

  async function generate() {
    setStatus("generating");
    setError("");

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courseId: course.id,
        blueprint,
        decks,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Generation failed.");
      setStatus("error");
      return;
    }

    setStats(payload.stats);
    router.push(`/notes/${payload.note.id}`);
  }

  return (
    <div className="border border-[#17130f]/15 bg-white p-5 shadow-[8px_8px_0_#17130f]">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Decks" value={decks.length} />
        <Metric label="Slides" value={slideCount} />
        <Metric label="Status" value={statusLabel(status)} />
      </div>

      <label className="mt-6 flex min-h-44 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-[#17130f]/25 bg-[#fdf9ef] px-5 text-center transition-colors hover:border-[#d9482e]">
        <span className="text-lg font-black">Drop in PPTX lecture files</span>
        <span className="mt-2 max-w-md text-sm leading-6 text-[#635a4d]">
          Multiple decks are merged into one cleaned Markdown extract before
          note generation.
        </span>
        <input
          className="sr-only"
          type="file"
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          multiple
          onChange={(event) => uploadFiles(event.target.files)}
        />
      </label>

      {decks.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-black uppercase tracking-[0.2em]">
            Uploaded decks
          </h2>
          <div className="mt-3 space-y-2">
            {decks.map((deck) => (
              <div
                key={deck.fileName}
                className="flex items-center justify-between gap-4 border border-[#17130f]/10 px-3 py-2 text-sm"
              >
                <span className="truncate font-bold">{deck.fileName}</span>
                <span className="shrink-0 text-[#635a4d]">
                  {deck.slides.length} slides
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <label className="mt-5 block">
        <span className="text-sm font-black uppercase tracking-[0.2em]">
          Blueprint focus
        </span>
        <textarea
          className="mt-3 min-h-36 w-full resize-y border border-[#17130f]/20 bg-[#fdf9ef] p-4 text-base outline-none focus:border-[#d9482e]"
          value={blueprint}
          onChange={(event) => setBlueprint(event.target.value)}
          placeholder="Paste units, chapters, exam blueprint, likely questions, or teacher hints."
        />
      </label>

      {error && (
        <p className="mt-4 border border-[#d9482e] bg-[#fff1ed] p-3 text-sm font-bold text-[#9f2d1d]">
          {error}
        </p>
      )}

      {stats && (
        <p className="mt-4 text-sm font-bold text-[#635a4d]">
          Kept {stats.retainedLines} lines, removed {stats.removedLines} noisy
          or duplicate lines.
        </p>
      )}

      <button
        className="mt-5 h-12 w-full bg-[#d9482e] px-5 text-sm font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#b73622] disabled:cursor-not-allowed disabled:bg-[#c9c1b5]"
        type="button"
        disabled={decks.length === 0 || status === "uploading" || status === "generating"}
        onClick={generate}
      >
        {status === "generating" ? "Generating notes..." : "Generate short notes"}
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#17130f]/10 bg-[#fdf9ef] p-3">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#635a4d]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function statusLabel(status: UploadState) {
  if (status === "uploading") {
    return "Parsing";
  }
  if (status === "ready") {
    return "Ready";
  }
  if (status === "generating") {
    return "Gemini";
  }
  if (status === "error") {
    return "Error";
  }
  return "Idle";
}
