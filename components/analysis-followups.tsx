"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Dumbbell, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AnalysisFollowups({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function startAssessment() {
    setBusy("assess");
    setError("");
    try {
      const res = await fetch("/api/v1/assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysisId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not start the test.");
      router.push(`/assessment/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the test.");
      setBusy("");
    }
  }

  return (
    <section className="mt-5 grid gap-4 rounded-[18px] border bg-[var(--surface)] p-5 sm:grid-cols-2 sm:p-6">
      <div className="flex flex-col gap-3">
        <span className="grid size-10 place-items-center rounded-[11px] bg-[var(--primary-soft)] text-[var(--primary)]"><ShieldCheck size={18} /></span>
        <div>
          <h3 className="text-sm font-semibold">Verify your skills (optional)</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">A short multiple-choice check on the skills from this analysis. Results set a verified level that the score and course plan then use.</p>
        </div>
        <Button size="sm" onClick={startAssessment} disabled={Boolean(busy)}>
          {busy === "assess" ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Take the skills check
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:border-l sm:pl-6">
        <span className="grid size-10 place-items-center rounded-[11px] bg-[var(--attention-soft)] text-[var(--attention)]"><Dumbbell size={18} /></span>
        <div>
          <h3 className="text-sm font-semibold">Practice the gaps</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Focused, timeboxed drills for each skill you lack — technical reps or workplace scenarios for soft skills.</p>
        </div>
        <Button asChild size="sm" variant="secondary"><Link href="/practice">Open practice <ArrowRight size={14} /></Link></Button>
      </div>

      {error && <p role="alert" className="text-sm text-[var(--critical)] sm:col-span-2">{error}</p>}
    </section>
  );
}
