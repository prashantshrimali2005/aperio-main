"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarRange, Check, Circle, GraduationCap, LoaderCircle, PlayCircle, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Module = {
  id: string;
  weekStart: number;
  weekEnd: number;
  skillId: string | null;
  skillName: string | null;
  title: string;
  objective: string;
  activities: string[];
  project: string;
  checkpoint: string;
  status: "not_started" | "in_progress" | "completed";
  position: number;
};
type Path = {
  id: string;
  title: string;
  summary: string;
  totalWeeks: number;
  weeklyHours: number;
  generator: string;
  roleTitle: string | null;
  modules: Module[];
};

export function LearningPathView({ initialPath }: { initialPath: Path | null }) {
  const [path, setPath] = useState<Path | null>(initialPath);
  const [hours, setHours] = useState(initialPath?.weeklyHours ?? 6);
  const [generating, setGenerating] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/v1/learning-paths", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weeklyHours: hours }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not build a path.");
      setPath(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build a path.");
    } finally {
      setGenerating(false);
    }
  }

  async function cycle(module: Module) {
    const next = module.status === "not_started" ? "in_progress" : module.status === "in_progress" ? "completed" : "not_started";
    setSavingId(module.id);
    setError("");
    try {
      const res = await fetch(`/api/v1/learning-paths/modules/${module.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("save failed");
      if (path) {
        setPath({ ...path, modules: path.modules.map((m) => (m.id === module.id ? { ...m, status: next } : m)) });
      }
    } catch {
      setError(`Couldn’t update “${module.title}”. Try again.`);
    } finally {
      setSavingId("");
    }
  }

  const statusLabel = { not_started: "Not started", in_progress: "In progress", completed: "Completed" } as const;

  const hoursPicker = (
    <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
      <CalendarRange size={14} />
      Study hours / week
      <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="h-8 rounded-[8px] border bg-[var(--surface-elevated)] px-2 text-xs font-semibold">
        {[3, 4, 6, 8, 10, 12, 15, 20].map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </label>
  );

  if (!path) {
    return (
      <div className="rounded-[20px] border bg-[var(--surface)] px-6 py-14 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-[14px] bg-[var(--primary-soft)] text-[var(--primary)]"><GraduationCap size={21} /></span>
        <h2 className="mt-5 text-lg font-semibold">Build your tailored course</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
          Aperio turns your latest analysis&rsquo; gaps into a week-by-week plan: objectives, hands-on projects, and checkpoints you can verify yourself.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          {hoursPicker}
          <Button onClick={generate} disabled={generating}>
            {generating ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {generating ? "Designing your plan…" : "Generate my course plan"}
          </Button>
        </div>
        <p className="mt-4 text-[11px] text-[var(--muted)]">Needs at least one analysis with open gaps. No course links or promised outcomes — a study plan grounded in your evidence.</p>
        {error && <p role="alert" className="mt-4 text-sm text-[var(--critical)]">{error}</p>}
      </div>
    );
  }

  const done = path.modules.filter((m) => m.status === "completed").length;

  return (
    <div>
      <section className="rounded-[20px] border bg-[var(--surface)] p-6 sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]"><Target size={14} />{path.roleTitle ?? "Career"} · {path.totalWeeks} weeks · {path.weeklyHours}h/wk</div>
            <h2 className="mb-0 mt-3 text-xl font-semibold tracking-[-.03em]">{path.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-strong)]">{path.summary}</p>
            <p className="mt-3 text-[11px] text-[var(--muted)]">{done}/{path.modules.length} modules done · {path.generator === "gemini" ? "Personalised by Aperio AI" : "Structured plan"}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {hoursPicker}
            <Button size="sm" variant="secondary" onClick={generate} disabled={generating}>
              {generating ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}Rebuild
            </Button>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="mt-4 text-sm text-[var(--critical)]">{error}</p>}

      <div className="mt-5 space-y-3">
        {path.modules.map((module) => (
          <article key={module.id} className="rounded-[16px] border bg-[var(--surface)] p-5">
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => cycle(module)}
                disabled={savingId === module.id}
                className={cn(
                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-60",
                  module.status === "completed" ? "bg-[var(--positive)] text-white" : module.status === "in_progress" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "border text-[var(--muted)]",
                )}
                aria-label={`${module.title}: ${statusLabel[module.status]}. Activate to move to next status.`}
              >
                {savingId === module.id ? <LoaderCircle size={15} className="animate-spin" /> : module.status === "completed" ? <Check size={16} /> : module.status === "in_progress" ? <PlayCircle size={16} /> : <Circle size={14} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                    Week {module.weekStart}{module.weekEnd !== module.weekStart ? `–${module.weekEnd}` : ""}
                  </span>
                  <h3 className="font-semibold">{module.title}</h3>
                  {module.skillName && <span className="text-xs text-[var(--muted)]">{module.skillName}</span>}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{module.objective}</p>
                {module.activities.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {module.activities.map((activity, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-5 text-[var(--muted)]"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--primary)]" />{activity}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <p className="rounded-[10px] bg-[var(--primary-soft)] p-3 text-xs leading-5 text-[var(--muted-strong)]"><span className="font-semibold text-[var(--primary)]">Project:</span> {module.project}</p>
                  <p className="rounded-[10px] bg-[var(--surface-elevated)] p-3 text-xs leading-5 text-[var(--muted-strong)]"><span className="font-semibold">Checkpoint:</span> {module.checkpoint}</p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-5 text-xs text-[var(--muted)]">
        Progress here records your learning state. It is not proof of mastery — re-run an <Link href="/analyze" className="font-semibold text-[var(--primary)]">analysis</Link> to see evidence-based movement.
      </p>
    </div>
  );
}
