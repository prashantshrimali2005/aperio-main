"use client";

import { useState } from "react";
import { Check, LoaderCircle, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

type Topic = { title: string; niche: string; level: string; track: string; rationale: string; skills: string[] };

function AiPanel({ onDraft }: { onDraft: (course: Record<string, unknown>, note: string) => void }) {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("mid");
  const [track, setTrack] = useState("technical");
  const [lessonCount, setLessonCount] = useState(7);
  const [audience, setAudience] = useState("");
  const [focus, setFocus] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [busy, setBusy] = useState<"" | "suggest" | "generate">("");
  const [error, setError] = useState("");

  function applyTopic(tp: Topic) {
    setTopic(tp.title);
    setLevel(tp.level);
    setTrack(tp.track);
  }

  async function suggest() {
    setBusy("suggest");
    setError("");
    try {
      const res = await fetch("/api/v1/admin/courses/suggest-topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ focus: focus.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not suggest topics.");
      const list = json.data.topics as Topic[];
      setTopics(list);
      if (list[0]) applyTopic(list[0]); // fill the fields so nothing has to be typed
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not suggest topics.");
    } finally {
      setBusy("");
    }
  }

  async function generate(seed?: Topic) {
    const t = seed?.title ?? topic.trim();
    if (!t) return;
    setBusy("generate");
    setError("");
    try {
      const res = await fetch("/api/v1/admin/courses/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic: t,
          level: seed?.level ?? level,
          track: seed?.track ?? track,
          lessonCount,
          audience: audience.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Generation failed.");
      const matched = Number(json.data.matchedSkillCount ?? 0);
      const named = (json.data.skillNames as string[] | undefined)?.length ?? 0;
      onDraft(
        json.data.course as Record<string, unknown>,
        `Draft generated — ${matched}/${named} skills matched to the catalog. Review the lessons, set the skills, then publish.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-[16px] border border-[var(--primary)]/30 bg-[var(--primary-soft)]/40 p-5">
      <div className="flex items-center gap-2">
        <Wand2 size={16} className="text-[var(--primary)]" />
        <h2 className="text-sm font-semibold">Author with Gemini</h2>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">Generate a full course — metadata and real lesson content — as a draft you review and publish.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium">Course topic</span>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Designing REST APIs that scale" />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium">Level</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="h-10 w-full rounded-[9px] border bg-[var(--surface-elevated)] px-3 text-sm">
            {["junior", "mid", "senior", "all"].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium">Track</span>
          <select value={track} onChange={(e) => setTrack(e.target.value)} className="h-10 w-full rounded-[9px] border bg-[var(--surface-elevated)] px-3 text-sm">
            {["technical", "soft", "mixed"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium">Lessons</span>
          <Input type="number" min={4} max={12} value={lessonCount} onChange={(e) => setLessonCount(Math.max(4, Math.min(12, Number(e.target.value) || 7)))} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium">Audience (optional)</span>
          <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. self-taught devs moving to backend" />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={suggest} disabled={Boolean(busy)}>
          {busy === "suggest" ? <LoaderCircle size={13} className="animate-spin" /> : <Wand2 size={13} />}Autofill fields
        </Button>
        <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="about… (optional)" className="h-9 w-44" />
        <Button size="sm" onClick={() => generate()} disabled={Boolean(busy) || !topic.trim()} className="ml-auto">
          {busy === "generate" ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}Generate course
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--muted)]">Autofill picks a fresh topic (never one you already have) and fills every field above. Tweak if you want, then Generate.</p>

      {error && <p role="alert" className="mt-2 text-xs text-[var(--critical)]">{error}</p>}

      {topics.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-medium text-[var(--muted)]">Other fresh topics — click to load one into the fields:</p>
          <div className="space-y-2">
            {topics.map((tp, i) => (
              <div key={i} className="flex items-start gap-3 rounded-[10px] border bg-[var(--surface)] p-3">
                <button type="button" onClick={() => applyTopic(tp)} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium">{tp.title}</p>
                  <p className="text-[11px] text-[var(--muted)]">{tp.niche} · {tp.level} · {tp.track} — {tp.rationale}</p>
                  {tp.skills.length > 0 && <p className="mt-1 text-[11px] text-[var(--muted-strong)]">Skills: {tp.skills.join(", ")}</p>}
                </button>
                <Button size="sm" variant="secondary" onClick={() => generate(tp)} disabled={Boolean(busy)}>
                  {busy === "generate" ? <LoaderCircle size={13} className="animate-spin" /> : "Generate"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type SkillOption = { id: string; name: string; skillType: string };
type CourseRow = Record<string, unknown>;
type Lesson = { id?: string; title: string; kind: string; content: string; resourceUrl: string | null; durationMin: number | null; position: number };

const KINDS = ["reading", "exercise", "video", "quiz", "project"];
const emptyLesson = (position: number): Lesson => ({ title: "", kind: "reading", content: "", resourceUrl: "", durationMin: null, position });

function Editor({ skills, initial, onSaved, onCancel }: { skills: SkillOption[]; initial?: Record<string, unknown>; onSaved: (c: CourseRow) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(String(initial?.title ?? ""));
  const [summary, setSummary] = useState(String(initial?.summary ?? ""));
  const [level, setLevel] = useState(String(initial?.level ?? "mid"));
  const [track, setTrack] = useState(String(initial?.track ?? "technical"));
  const [published, setPublished] = useState(Boolean(initial?.published));
  const [skillIds, setSkillIds] = useState<string[]>(Array.isArray(initial?.skillIds) ? (initial!.skillIds as string[]) : []);
  const [lessons, setLessons] = useState<Lesson[]>(Array.isArray(initial?.lessons) && (initial!.lessons as Lesson[]).length ? (initial!.lessons as Lesson[]) : [emptyLesson(0)]);
  const [priceInr, setPriceInr] = useState<number>(Number(initial?.priceInr ?? 0) || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/v1/admin/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: initial?.id,
          title,
          summary,
          level,
          track,
          published,
          priceInr,
          skillIds,
          lessons: lessons
            .filter((l) => l.title.trim())
            .map((l, i) => ({ ...l, resourceUrl: l.resourceUrl || null, durationMin: l.durationMin ? Number(l.durationMin) : null, position: i })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Save failed.");
      onSaved(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[16px] border bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{initial?.id ? "Edit course" : "New course"}</h2>
        <button type="button" onClick={onCancel} aria-label="Close editor" className="text-[var(--muted)] hover:text-[var(--foreground)]"><X size={16} /></button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium">Title</span><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Backend fundamentals for mid engineers" /></label>
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium">Summary</span><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium">Level</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="h-10 w-full rounded-[9px] border bg-[var(--surface-elevated)] px-3 text-sm">
            {["junior", "mid", "senior", "all"].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium">Track</span>
          <select value={track} onChange={(e) => setTrack(e.target.value)} className="h-10 w-full rounded-[9px] border bg-[var(--surface-elevated)] px-3 text-sm">
            {["technical", "soft", "mixed"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium">Price ₹ — set 0 to make it free (no payment)</span>
          <Input type="number" min={0} value={priceInr} onChange={(e) => setPriceInr(Math.max(0, Math.round(Number(e.target.value) || 0)))} placeholder="0" />
        </label>
      </div>

      <div className="mt-4">
        <span className="mb-1.5 block text-xs font-medium">Skills covered ({skillIds.length})</span>
        <div className="max-h-40 overflow-auto rounded-[10px] border p-2">
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => {
              const on = skillIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSkillIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${on ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-muted)] text-[var(--muted-strong)]"}`}
                >
                  {s.name}{s.skillType === "soft" ? " ·s" : ""}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Lessons ({lessons.filter((l) => l.title.trim()).length})</span>
          <button type="button" onClick={() => setLessons((ls) => [...ls, emptyLesson(ls.length)])} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"><Plus size={12} />Add lesson</button>
        </div>
        <div className="mt-2 space-y-2">
          {lessons.map((l, i) => (
            <div key={i} className="rounded-[10px] border bg-[var(--surface-elevated)] p-3">
              <div className="flex gap-2">
                <Input value={l.title} onChange={(e) => setLessons((ls) => ls.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder={`Lesson ${i + 1} title`} className="flex-1" />
                <select value={l.kind} onChange={(e) => setLessons((ls) => ls.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))} className="h-10 rounded-[9px] border bg-[var(--surface)] px-2 text-xs">
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <button type="button" onClick={() => setLessons((ls) => ls.filter((_, j) => j !== i))} aria-label={`Remove lesson ${i + 1}`} className="grid size-10 shrink-0 place-items-center rounded-[9px] text-[var(--muted)] hover:text-[var(--critical)]"><Trash2 size={14} /></button>
              </div>
              <Textarea value={l.content} onChange={(e) => setLessons((ls) => ls.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))} rows={2} placeholder="Lesson content / instructions" className="mt-2" />
              <div className="mt-2 flex gap-2">
                <Input value={l.resourceUrl ?? ""} onChange={(e) => setLessons((ls) => ls.map((x, j) => (j === i ? { ...x, resourceUrl: e.target.value } : x)))} placeholder="https://resource (optional)" className="flex-1" />
                <Input type="number" value={l.durationMin ?? ""} onChange={(e) => setLessons((ls) => ls.map((x, j) => (j === i ? { ...x, durationMin: e.target.value ? Number(e.target.value) : null } : x)))} placeholder="min" className="w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={published} onChange={(e) => setPublished(e.target.checked)} />Published</label>
        <Button size="sm" onClick={save} loading={saving} disabled={!title.trim()}>{!saving && <Check size={14} />}Save course</Button>
        {error && <span role="alert" className="text-xs text-[var(--critical)]">{error}</span>}
      </div>
    </div>
  );
}

export function CourseManager({ initialCourses, skills, embedded }: { initialCourses: CourseRow[]; skills: SkillOption[]; embedded?: boolean }) {
  const [courses, setCourses] = useState(initialCourses);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadingId, setLoadingId] = useState("");
  const [aiNote, setAiNote] = useState("");

  function openDraft(course: Record<string, unknown>, note: string) {
    setCourses((c) => (c.some((x) => x.id === course.id) ? c : [{ ...course, lessons: Array.isArray((course as { lessons?: unknown[] }).lessons) ? (course as { lessons: unknown[] }).lessons.length : 0, enrollments: 0 }, ...c]));
    setEditing(course);
    setCreating(false);
    setAiNote(note);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function openEdit(id: string) {
    setLoadingId(id);
    const res = await fetch(`/api/v1/admin/courses/${id}`);
    const json = await res.json();
    setLoadingId("");
    if (res.ok) {
      setEditing(json.data);
      setCreating(false);
    }
  }

  const [removeError, setRemoveError] = useState("");

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”? Enrolled users lose access and this can't be undone.`)) return;
    const prev = courses;
    setRemoveError("");
    setCourses((c) => c.filter((x) => x.id !== id));
    const res = await fetch(`/api/v1/admin/courses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setCourses(prev);
      setRemoveError("Couldn’t delete that course. Try again.");
    }
  }

  function afterSave(saved: CourseRow) {
    setCourses((c) => {
      const exists = c.some((x) => x.id === saved.id);
      const row = {
        ...saved,
        lessons: Array.isArray((saved as { lessons?: unknown[] }).lessons) ? (saved as { lessons: unknown[] }).lessons.length : 0,
        enrollments: 0,
      };
      return exists ? c.map((x) => (x.id === saved.id ? { ...x, ...row } : x)) : [row, ...c];
    });
    setEditing(null);
    setCreating(false);
    setAiNote("");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          {!embedded && <h1 className="text-2xl font-semibold tracking-tight">LMS</h1>}
          <p className={embedded ? "text-sm text-[var(--muted)]" : "mt-1 text-sm text-[var(--muted)]"}>Build courses; published ones are auto-recommended to users by skill-gap overlap.</p>
        </div>
        {!creating && !editing && <Button size="sm" onClick={() => { setCreating(true); setEditing(null); }}><Plus size={14} />New course</Button>}
      </div>

      {!creating && !editing && <AiPanel onDraft={openDraft} />}

      {aiNote && (creating || editing) && (
        <p className="rounded-[10px] border border-[var(--primary)]/30 bg-[var(--primary-soft)]/40 px-3 py-2 text-xs text-[var(--muted-strong)]">{aiNote}</p>
      )}

      {(creating || editing) && (
        <Editor
          skills={skills}
          initial={editing ?? undefined}
          onSaved={afterSave}
          onCancel={() => { setEditing(null); setCreating(false); setAiNote(""); }}
        />
      )}

      <div className="overflow-hidden rounded-[14px] border bg-[var(--surface)]">
        {courses.map((c) => (
          <div key={String(c.id)} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-0">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                {String(c.title)}
                <span className={`rounded px-1.5 text-[10px] font-semibold ${c.published ? "bg-[var(--positive-soft)] text-[var(--positive)]" : "bg-[var(--surface-muted)] text-[var(--muted)]"}`}>{c.published ? "published" : "draft"}</span>
              </p>
              <p className="text-xs text-[var(--muted)]">{String(c.track)} · {String(c.level)} · {Number(c.lessons)} lessons · {Number(c.enrollments)} enrolled · {Number(c.priceInr) > 0 ? `₹${Number(c.priceInr)}` : "free"}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="secondary" onClick={() => openEdit(String(c.id))} disabled={loadingId === c.id}>{loadingId === c.id ? <LoaderCircle size={13} className="animate-spin" /> : "Edit"}</Button>
              <button type="button" onClick={() => remove(String(c.id), String(c.title))} aria-label={`Delete ${String(c.title)}`} className="grid size-8 place-items-center rounded-[8px] text-[var(--muted)] hover:text-[var(--critical)]"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {!courses.length && <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">No courses yet.</p>}
      </div>
      {removeError && <p role="alert" className="text-xs text-[var(--critical)]">{removeError}</p>}
    </div>
  );
}
