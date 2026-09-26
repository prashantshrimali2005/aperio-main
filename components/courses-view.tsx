"use client";

import { useState } from "react";
import { BookOpen, Check, ChevronDown, Circle, GraduationCap, LoaderCircle, Lock, PlayCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { purchaseItem } from "@/components/razorpay-checkout";
import { cn } from "@/lib/utils";

type RecCourse = { id: string; slug: string; title: string; summary: string; level: string; track: string; lessons: number; matchCount: number; enrolled: boolean; priceInr?: number; owned?: boolean };
type EnrolledCourse = { id: string; title: string; summary: string; track: string; status: string; source: string; lessons: number; completed: number };
type Lesson = { id: string; title: string; kind: string; content: string; resourceUrl: string | null; durationMin: number | null; status: string };

function LessonList({ courseId }: { courseId: string }) {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");

  const [loadError, setLoadError] = useState(false);

  async function load() {
    if (lessons) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/v1/courses/${courseId}`);
      const json = await res.json();
      if (!res.ok) throw new Error("load failed");
      setLessons(json.data.lessons ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function toggle(lesson: Lesson) {
    const next = lesson.status === "completed" ? "not_started" : lesson.status === "not_started" ? "in_progress" : "completed";
    setBusy(lesson.id);
    try {
      const res = await fetch(`/api/v1/courses/lessons/${lesson.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("save failed");
      setLessons((ls) => ls?.map((l) => (l.id === lesson.id ? { ...l, status: next } : l)) ?? null);
    } catch {
      setLoadError(true);
    } finally {
      setBusy("");
    }
  }

  const statusLabel = { not_started: "Not started", in_progress: "In progress", completed: "Completed" } as const;

  return (
    <details className="mt-3" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && load()}>
      <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--primary)]"><ChevronDown size={13} />Lessons</summary>
      {loading && <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]"><LoaderCircle size={12} className="animate-spin" />Loading…</p>}
      {loadError && <p role="alert" className="mt-2 text-xs text-[var(--critical)]">Couldn’t load lessons. Close and reopen to retry.</p>}
      {lessons && (
        <ol className="mt-2 space-y-1.5">
          {lessons.map((l) => (
            <li key={l.id} className="rounded-[9px] border p-2.5 text-sm">
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => toggle(l)}
                  disabled={busy === l.id}
                  aria-label={`${l.title}: ${statusLabel[l.status as keyof typeof statusLabel] ?? l.status}. Activate to change.`}
                  className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-60", l.status === "completed" ? "bg-[var(--positive)] text-white" : l.status === "in_progress" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "border text-[var(--muted)]")}
                >
                  {busy === l.id ? <LoaderCircle size={11} className="animate-spin" /> : l.status === "completed" ? <Check size={12} /> : l.status === "in_progress" ? <PlayCircle size={12} /> : <Circle size={10} />}
                </button>
                <div className="min-w-0">
                  <p className="font-medium">{l.title} <span className="text-[10px] font-normal text-[var(--muted)]">· {l.kind}{l.durationMin ? ` · ${l.durationMin}m` : ""}</span></p>
                  {l.content && <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-[var(--muted)]">{l.content}</p>}
                  {l.resourceUrl && <a href={l.resourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-[var(--primary)] hover:underline">Open resource</a>}
                </div>
              </div>
            </li>
          ))}
          {!lessons.length && <li className="text-xs text-[var(--muted)]">No lessons yet.</li>}
        </ol>
      )}
    </details>
  );
}

export function CoursesView({ initial }: { initial: { recommended: RecCourse[]; enrolled: EnrolledCourse[] } }) {
  const [recommended, setRecommended] = useState(initial.recommended);
  const [enrolled, setEnrolled] = useState(initial.enrolled);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  function moveToEnrolled(course: RecCourse) {
    setRecommended((r) => r.filter((x) => x.id !== course.id));
    setEnrolled((e) => [{ id: course.id, title: course.title, summary: course.summary, track: course.track, status: "active", source: "recommended", lessons: course.lessons, completed: 0 }, ...e]);
  }

  async function enroll(course: RecCourse) {
    setBusy(course.id);
    setError("");
    try {
      const paid = Number(course.priceInr) > 0 && !course.owned;
      if (paid) {
        const done = await purchaseItem("course", course.id);
        if (!done) return; // dismissed
        moveToEnrolled(course);
        return;
      }
      const res = await fetch(`/api/v1/courses/${course.id}/enroll`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "recommended" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || "Could not enrol.");
      }
      moveToEnrolled(course);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enrol.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-[var(--primary)]">Courses</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Courses matched to your gaps</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Structured courses your admins built, recommended by how well they cover the skills missing from your latest analysis — technical and soft.</p>
      </div>

      {error && <p role="alert" className="text-sm text-[var(--critical)]">{error}</p>}

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="text-[var(--primary)]" />Recommended for you</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {recommended.map((c) => (
            <div key={c.id} className="rounded-[14px] border bg-[var(--surface)] p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[var(--positive-soft)] px-1.5 text-[10px] font-semibold text-[var(--positive)]">{c.matchCount} gap match{c.matchCount === 1 ? "" : "es"}</span>
                <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{c.track} · {c.level}</span>
              </div>
              <h3 className="mt-2 font-semibold">{c.title}</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{c.summary}</p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => enroll(c)} disabled={busy === c.id}>
                  {busy === c.id ? <LoaderCircle size={14} className="animate-spin" /> : Number(c.priceInr) > 0 && !c.owned ? <Lock size={14} /> : <BookOpen size={14} />}
                  {Number(c.priceInr) > 0 && !c.owned ? `Buy · ₹${Number(c.priceInr)}` : `Enrol · ${c.lessons} lessons`}
                </Button>
                {Number(c.priceInr) > 0 && !c.owned && <span className="text-[11px] text-[var(--muted)]">{c.lessons} lessons</span>}
              </div>
            </div>
          ))}
          {!recommended.length && <p className="text-sm text-[var(--muted)]">No matching courses yet. Run an analysis, or check back once more courses are published.</p>}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><GraduationCap size={15} className="text-[var(--primary)]" />Your courses</h2>
        <div className="mt-3 space-y-3">
          {enrolled.map((c) => (
            <div key={c.id} className="rounded-[14px] border bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{c.title}</h3>
                <span className="text-xs text-[var(--muted)]">{c.completed}/{c.lessons} done{c.status === "completed" ? " · completed" : ""}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{c.summary}</p>
              <LessonList courseId={c.id} />
            </div>
          ))}
          {!enrolled.length && <p className="text-sm text-[var(--muted)]">You are not enrolled in any course yet.</p>}
        </div>
      </section>
    </div>
  );
}
