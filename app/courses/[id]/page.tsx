import Link from "next/link";
import { notFound } from "next/navigation";
import CourseWorkspace from "@/components/course-workspace";
import { getCourse } from "@/lib/courses";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = getCourse(id);

  if (!course) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f6f2e8] text-[#17130f]">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        <Link href="/" className="text-sm font-black uppercase tracking-[0.24em]">
          ExitNotes
        </Link>
        <section className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#d9482e]">
              Course workspace
            </p>
            <h1 className="mt-4 text-5xl font-black leading-none">
              {course.title}
            </h1>
            <p className="mt-5 text-lg leading-8 text-[#4d463e]">
              {course.description}
            </p>
          </div>
          <CourseWorkspace course={course} />
        </section>
      </div>
    </main>
  );
}
