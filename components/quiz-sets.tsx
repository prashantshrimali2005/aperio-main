"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Loader, LoaderCircle, Lock, Trophy, X } from "lucide-react";
import { purchaseItem } from "@/components/razorpay-checkout";
import { cn } from "@/lib/utils";

type SetRow = {
  id: string;
  title: string;
  niche: string;
  topic: string;
  level: string;
  description: string;
  questionCount: number;
  bestScore: number | null;
  attempts: number;
  priceInr?: number;
  owned?: boolean;
};
type Question = { id: string; prompt: string; options: string[]; position: number };
type ReviewItem = { questionId: string; prompt: string; options: string[]; picked: number; correctIndex: number; correct: boolean; explanation: string };
type Result = { score: number; correct: number; total: number; review: ReviewItem[] };

function Runner({ set, onClose, onScored }: { set: SetRow; onClose: () => void; onScored: (score: number) => void }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/quiz-sets/${set.id}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.data?.questions) setQuestions(j.data.questions as Question[]);
        else setError(j?.error?.message || "Could not load this set.");
      })
      .catch(() => !cancelled && setError("Could not load this set."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [set.id]);

  async function submit() {
    if (!questions) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/quiz-sets/${set.id}/attempt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: questions.map((q) => ({ questionId: q.id, answerIndex: answers[q.id] ?? 0 })) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not submit.");
      setResult(json.data as Result);
      onScored((json.data as Result).score);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  const answeredAll = questions ? questions.every((q) => answers[q.id] !== undefined) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-runner-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-[18px] border bg-[var(--surface)] p-5 shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--primary)]">{set.niche} · {set.level}</p>
            <h2 id="quiz-runner-title" className="mt-1 text-lg font-semibold">{set.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close quiz" className="grid size-8 place-items-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--surface-muted)]"><X size={16} /></button>
        </div>

        {loading && <div className="py-16 text-center"><LoaderCircle size={20} className="mx-auto animate-spin text-[var(--muted)]" /><span className="sr-only">Loading questions…</span></div>}
        {error && <p role="alert" className="mt-3 text-sm text-[var(--critical)]">{error}</p>}

        {!loading && result && (
          <div className="mt-4">
            <div className="flex items-center gap-3 rounded-[12px] bg-[var(--primary-soft)] p-4">
              <Trophy size={22} className="text-[var(--primary)]" />
              <div>
                <p className="text-2xl font-semibold">{result.score}%</p>
                <p className="text-xs text-[var(--muted-strong)]">{result.correct} of {result.total} correct</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {result.review.map((r, i) => (
                <div key={r.questionId} className="rounded-[12px] border p-3 text-sm">
                  <p className="font-medium">{i + 1}. {r.prompt}</p>
                  <ul className="mt-1.5 space-y-1">
                    {r.options.map((o, j) => (
                      <li
                        key={j}
                        className={cn(
                          "rounded-[8px] px-2 py-1 text-xs",
                          j === r.correctIndex && "bg-[var(--positive-soft)] font-medium text-[var(--positive)]",
                          j === r.picked && j !== r.correctIndex && "bg-[var(--critical-soft,rgba(220,38,38,.1))] text-[var(--critical)]",
                        )}
                      >
                        {String.fromCharCode(65 + j)}. {o}
                        {j === r.correctIndex ? "  ✓" : j === r.picked ? "  ✗" : ""}
                      </li>
                    ))}
                  </ul>
                  {r.explanation && <p className="mt-1.5 text-xs text-[var(--muted)]">{r.explanation}</p>}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onClose} className="rounded-[10px] border px-4 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]"><ChevronLeft size={14} className="mr-1 inline" />Done</button>
              <button
                type="button"
                onClick={() => { setResult(null); setAnswers({}); }}
                className="rounded-[10px] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
              >
                Retake
              </button>
            </div>
          </div>
        )}

        {!loading && !result && questions && (
          <div className="mt-4">
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={q.id}>
                  <p className="text-sm font-medium" id={`q-${q.id}`}>{i + 1}. {q.prompt}</p>
                  <div className="mt-2 space-y-1.5" role="radiogroup" aria-labelledby={`q-${q.id}`}>
                    {q.options.map((o, j) => (
                      <button
                        key={j}
                        type="button"
                        role="radio"
                        aria-checked={answers[q.id] === j}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: j }))}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-[9px] border px-3 py-2 text-left text-sm transition",
                          answers[q.id] === j ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "hover:border-[var(--muted)]",
                        )}
                      >
                        <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border text-[10px]", answers[q.id] === j && "border-[var(--primary)] bg-[var(--primary)] text-white")}>
                          {answers[q.id] === j ? <Check size={10} /> : String.fromCharCode(65 + j)}
                        </span>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 mt-5 flex items-center gap-3 bg-[var(--surface)] pt-3">
              <button
                type="button"
                onClick={submit}
                disabled={!answeredAll || submitting}
                aria-busy={submitting}
                className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting && <LoaderCircle size={14} className="animate-spin" />}
                {submitting ? "Scoring…" : `Submit ${questions.length} answers`}
              </button>
              {!answeredAll && <span className="text-xs text-[var(--muted)]">Answer every question to submit.</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function QuizSets({ initial }: { initial: SetRow[] }) {
  const [sets, setSets] = useState(initial);
  const [active, setActive] = useState<SetRow | null>(null);
  const [buying, setBuying] = useState("");
  const [error, setError] = useState("");

  if (!sets.length) return null;

  async function openSet(s: SetRow) {
    if (Number(s.priceInr) > 0 && !s.owned) {
      setBuying(s.id);
      setError("");
      try {
        const done = await purchaseItem("question_set", s.id);
        if (!done) return;
        setSets((prev) => prev.map((x) => (x.id === s.id ? { ...x, owned: true } : x)));
        setActive({ ...s, owned: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment failed.");
      } finally {
        setBuying("");
      }
      return;
    }
    setActive(s);
  }

  const byNiche = sets.reduce<Record<string, SetRow[]>>((acc, s) => {
    (acc[s.niche || "General"] ||= []).push(s);
    return acc;
  }, {});

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-[-.02em]">Question sets</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Timed-free multiple-choice sets across topics. Retake any set to raise your score.</p>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--critical)]">{error}</p>}

      <div className="mt-4 space-y-6">
        {Object.entries(byNiche).map(([niche, rows]) => (
          <div key={niche}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{niche}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((s) => {
                const locked = Number(s.priceInr) > 0 && !s.owned;
                return (
                  <button
                    key={s.id}
                    onClick={() => openSet(s)}
                    disabled={buying === s.id}
                    className="rounded-[14px] border bg-[var(--surface)] p-4 text-left transition hover:border-[var(--primary)] disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{s.title}</h3>
                      {buying === s.id ? (
                        <Loader size={13} className="shrink-0 animate-spin text-[var(--muted)]" />
                      ) : locked ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold"><Lock size={10} />₹{Number(s.priceInr)}</span>
                      ) : s.bestScore !== null ? (
                        <span className="shrink-0 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)]">best {s.bestScore}%</span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{s.description}</p>
                    <p className="mt-2 text-[11px] text-[var(--muted-strong)]">{s.questionCount} questions · {s.level}{s.attempts ? ` · ${s.attempts} attempt${s.attempts > 1 ? "s" : ""}` : ""}{locked ? " · tap to buy" : ""}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {active && (
        <Runner
          set={active}
          onClose={() => setActive(null)}
          onScored={(score) =>
            setSets((prev) =>
              prev.map((x) =>
                x.id === active.id ? { ...x, bestScore: Math.max(x.bestScore ?? 0, score), attempts: x.attempts + 1 } : x,
              ),
            )
          }
        />
      )}
    </section>
  );
}
