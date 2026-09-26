"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, CircleCheck, CircleX, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { skillLevelLabel } from "@/lib/types";

type Question = {
  id: string;
  skillId: string;
  skillName: string;
  skillType: "technical" | "soft";
  prompt: string;
  options: string[];
  answerIndex: number | null;
  correctIndex?: number;
};
type Result = { skillId: string; skillName: string; correct: number; total: number; score: number; level: number };
type Assessment = {
  id: string;
  status: "pending" | "completed" | "expired";
  score: number | null;
  roleTitle: string | null;
  analysisId: string | null;
  questions: Question[];
  results: Result[];
};

export function AssessmentRunner({ assessment }: { assessment: Assessment }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(assessment.status === "completed");
  const [summary, setSummary] = useState<{ score: number; perSkill: Result[]; newAnalysisId: string | null } | null>(
    assessment.status === "completed" && assessment.score != null
      ? { score: assessment.score, perSkill: assessment.results, newAnalysisId: null }
      : null,
  );

  const answered = Object.keys(answers).length;
  const total = assessment.questions.length;
  const canSubmit = answered === total && !submitting;

  const grouped = useMemo(() => {
    const map = new Map<string, Question[]>();
    for (const q of assessment.questions) {
      const list = map.get(q.skillName) ?? [];
      list.push(q);
      map.set(q.skillName, list);
    }
    return [...map.entries()];
  }, [assessment.questions]);

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/assessments/${assessment.id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: Object.entries(answers).map(([questionId, answerIndex]) => ({ questionId, answerIndex })) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not submit.");
      setSummary(json.data);
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done && summary) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[20px] border bg-[var(--surface)] p-7 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-[16px] bg-[var(--positive-soft)] text-[var(--positive)]"><ShieldCheck size={24} /></span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Skills check complete</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Overall {summary.score}% · your verified levels now feed the score and recommendations.</p>
          <div className="mt-6 divide-y text-left">
            {summary.perSkill.map((r) => (
              <div key={r.skillId} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium">{r.skillName}</span>
                <span className="text-xs text-[var(--muted)]">{r.correct}/{r.total} · {r.score}% → <b className="text-[var(--foreground)]">{skillLevelLabel[r.level]}</b></span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {summary.newAnalysisId && (
              <Button asChild><Link href={`/history/${summary.newAnalysisId}`}>See updated analysis <ArrowRight size={15} /></Link></Button>
            )}
            <Button asChild variant="secondary"><Link href="/learning">Course plan</Link></Button>
            <Button asChild variant="ghost"><Link href="/practice">Practice</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-[16px] border bg-[var(--surface)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--primary)]">Optional skills check</p>
        <h1 className="mt-1.5 text-xl font-semibold tracking-tight">{assessment.roleTitle ?? "Your skills"} — quick verification</h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">{total} questions. Your answers set a verified level for each skill, which the analyzer trusts above résumé inference.</p>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answered}
          aria-label={`${answered} of ${total} questions answered`}
        >
          <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {grouped.map(([skillName, questions]) => (
          <div key={skillName}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{skillName}</p>
            <div className="space-y-3">
              {questions.map((q) => (
                <fieldset key={q.id} className="rounded-[14px] border bg-[var(--surface)] p-4">
                  <legend className="mb-2 text-sm font-medium">{q.prompt}</legend>
                  <div className="space-y-1.5" role="radiogroup" aria-label={q.prompt}>
                    {q.options.map((opt, i) => {
                      const chosen = answers[q.id] === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          role="radio"
                          aria-checked={chosen}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-2 text-left text-sm transition",
                            chosen ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "hover:bg-[var(--surface-elevated)]",
                          )}
                        >
                          <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border", chosen && "border-[var(--primary)] bg-[var(--primary)] text-white")}>
                            {chosen && <Check size={11} />}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-[var(--critical)]">{error}</p>}
      <div className="sticky bottom-3 mt-5 flex items-center justify-between gap-3 rounded-[12px] border bg-[var(--surface-glass)] p-3 backdrop-blur">
        <span className="text-xs text-[var(--muted)]">{answered}/{total} answered</span>
        <Button onClick={submit} disabled={!canSubmit}>
          {submitting ? <LoaderCircle size={15} className="animate-spin" /> : <CircleCheck size={15} />}Submit & score
        </Button>
      </div>
      {answered < total && <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]"><CircleX size={12} />Answer every question to submit.</p>}
    </div>
  );
}
