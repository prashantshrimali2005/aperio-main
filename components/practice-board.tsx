"use client";

import { useState } from "react";
import { Check, Circle, Clock3, Dumbbell, LoaderCircle, PlayCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Drill = { title: string; instruction: string; timeboxMinutes: number };
type Session = {
  id: string;
  skillId: string;
  skillName: string;
  skillType: "technical" | "soft";
  title: string;
  focus: string;
  drills: Drill[];
  selfCheck: string;
  status: "not_started" | "in_progress" | "completed";
};
type Suggestion = { skillId: string; name: string; skillType: string; currentLevel: number; targetLevel: number };

export function PracticeBoard({ initial }: { initial: { sessions: Session[]; suggestions: Suggestion[] } }) {
  const [sessions, setSessions] = useState(initial.sessions);
  const [suggestions, setSuggestions] = useState(initial.suggestions);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function generate(skillId: string) {
    setBusy(skillId);
    setError("");
    try {
      const res = await fetch("/api/v1/practice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skillId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not build a session.");
      setSessions((s) => [json.data, ...s]);
      setSuggestions((s) => s.filter((x) => x.skillId !== skillId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build a session.");
    } finally {
      setBusy("");
    }
  }

  async function cycle(session: Session) {
    const next = session.status === "not_started" ? "in_progress" : session.status === "in_progress" ? "completed" : "not_started";
    setBusy(session.id);
    setError("");
    try {
      const res = await fetch(`/api/v1/practice/${session.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("save failed");
      setSessions((s) => s.map((x) => (x.id === session.id ? { ...x, status: next } : x)));
    } catch {
      setError(`Couldn’t update “${session.title}”. Try again.`);
    } finally {
      setBusy("");
    }
  }

  const statusLabel = { not_started: "Not started", in_progress: "In progress", completed: "Completed" } as const;

  return (
    <div>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-[var(--primary)]">Targeted practice</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Practice the skills you lack</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Short, timeboxed drills for each gap — hands-on reps for technical skills, real workplace actions for soft skills. Progress is tracked, not treated as proof of mastery.</p>
      </div>

      {suggestions.length > 0 && (
        <section className="mt-7 rounded-[16px] border bg-[var(--surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">From your latest analysis</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.skillId}
                onClick={() => generate(s.skillId)}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-1.5 rounded-[10px] border bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--primary)] disabled:opacity-50"
              >
                {busy === s.skillId ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} className="text-[var(--primary)]" />}
                {s.name}
                {s.skillType === "soft" && <span className="rounded bg-[var(--surface-muted)] px-1 text-[9px] font-semibold text-[var(--muted)]">soft</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-[var(--critical)]">{error}</p>}

      <div className="mt-5 space-y-4">
        {sessions.map((session) => (
          <article key={session.id} className="rounded-[16px] border bg-[var(--surface)] p-5">
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => cycle(session)}
                disabled={busy === session.id}
                className={cn(
                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-60",
                  session.status === "completed" ? "bg-[var(--positive)] text-white" : session.status === "in_progress" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "border text-[var(--muted)]",
                )}
                aria-label={`${session.title}: ${statusLabel[session.status]}. Activate to move to next status.`}
              >
                {busy === session.id ? <LoaderCircle size={15} className="animate-spin" /> : session.status === "completed" ? <Check size={16} /> : session.status === "in_progress" ? <PlayCircle size={16} /> : <Circle size={14} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{session.title}</h3>
                  <span className="rounded bg-[var(--surface-muted)] px-1.5 text-[10px] font-semibold text-[var(--muted)]">{session.skillName}</span>
                </div>
                <p className="mt-1.5 text-sm text-[var(--muted-strong)]">{session.focus}</p>
                <ol className="mt-3 space-y-2">
                  {session.drills.map((drill, i) => (
                    <li key={i} className="rounded-[10px] bg-[var(--surface-elevated)] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{i + 1}. {drill.title}</span>
                        <span className="flex items-center gap-1 text-[11px] text-[var(--muted)]"><Clock3 size={11} />{drill.timeboxMinutes}m</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{drill.instruction}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 rounded-[10px] bg-[var(--primary-soft)] p-3 text-xs leading-5 text-[var(--muted-strong)]"><b className="text-[var(--primary)]">Self-check:</b> {session.selfCheck}</p>
              </div>
            </div>
          </article>
        ))}
        {!sessions.length && (
          <div className="rounded-[16px] border bg-[var(--surface)] px-6 py-12 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-[13px] bg-[var(--primary-soft)] text-[var(--primary)]"><Dumbbell size={20} /></span>
            <p className="mt-4 text-sm text-[var(--muted)]">Pick a skill above to generate your first practice session, or run an analysis to get suggestions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
