import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, FileSearch, Gauge, Layers3, Sparkles, Target } from "lucide-react";
import { OverviewDashboard } from "@/components/overview-dashboard";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { getAnalysisHistory, getLatestReport, getRoadmap } from "@/lib/reports";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const user = await requirePageUser();
  const [report, history, roadmap] = await Promise.all([
    getLatestReport(user.id),
    getAnalysisHistory(user.id, 12),
    getRoadmap(user.id),
  ]);
  const roadmapItems = roadmap && Array.isArray(roadmap.items) ? roadmap.items : [];
  const firstName = user.fullName.trim().split(" ")[0] || "there";

  return (
    <div className="aperio-page">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="aperio-eyebrow">Career readiness overview</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-.04em] sm:text-[30px]">Welcome back, {firstName}.</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{report ? "Here’s what your current evidence says—and what to focus on next." : "Build your evidence profile to understand your strongest next career move."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {report && <><Link href={`/analyze?role=${report.roleId}`} className="inline-flex h-10 min-w-0 items-center gap-2 rounded-[10px] border bg-[var(--surface)] px-3 text-xs font-semibold transition hover:border-[var(--border-strong)]"><BriefcaseBusiness size={14} className="text-[var(--primary)]" /><span className="max-w-44 truncate">{report.roleTitle}</span></Link><span className="inline-flex h-10 items-center gap-2 rounded-[10px] border bg-[var(--surface)] px-3 text-xs font-semibold capitalize"><Layers3 size={14} className="text-[var(--muted)]" />{report.experienceLevel} level</span></>}
          <Button asChild><Link href={report ? `/analyze?role=${report.roleId}` : "/analyze"}><Sparkles size={15} />{report ? "Re-analyze" : "Start analysis"}</Link></Button>
        </div>
      </header>

      <div className="mt-7">
        {report ? <OverviewDashboard report={report} roadmapItems={roadmapItems as never[]} history={history as never[]} /> : <EmptyDashboard />}
      </div>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <section className="aperio-panel overflow-hidden">
      <div className="grid lg:grid-cols-[1.12fr_.88fr]">
        <div className="relative border-b p-6 sm:p-9 lg:border-b-0 lg:border-r">
          <div className="pointer-events-none absolute right-0 top-0 size-64 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_68%)]" />
          <p className="relative text-xs font-semibold">Career Match</p>
          <div className="relative mt-8 flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="text-6xl font-semibold tracking-[-.07em] text-[var(--muted)]">—</div><p className="mt-3 text-sm font-semibold">No role analyzed yet</p><p className="mt-2 max-w-sm text-xs leading-5 text-[var(--muted)]">Your dashboard starts clean. Aperio will only show scores after it has real profile or resume evidence.</p></div>
            <span className="grid size-28 shrink-0 place-items-center rounded-full border-[9px] border-[var(--surface-muted)] text-[var(--muted)]"><Gauge size={27} /></span>
          </div>
          <div className="relative mt-8 grid grid-cols-3 gap-3 border-t pt-5 text-center sm:text-left"><span><strong className="block text-lg">—</strong><span className="text-[10px] text-[var(--muted)]">Matched</span></span><span><strong className="block text-lg">—</strong><span className="text-[10px] text-[var(--muted)]">Developing</span></span><span><strong className="block text-lg">—</strong><span className="text-[10px] text-[var(--muted)]">Gaps</span></span></div>
        </div>
        <div className="bg-[var(--surface-elevated)] p-6 sm:p-9">
          <span className="grid size-11 place-items-center rounded-[12px] bg-[var(--primary-soft)] text-[var(--primary)]"><FileSearch size={19} /></span>
          <p className="aperio-eyebrow mt-6">First analysis</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-.025em]">Turn your resume into a career map.</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">Select a target role, upload a verified resume, and get an evidence-backed match, skill gaps, and personal roadmap.</p>
          <Button asChild className="mt-6"><Link href="/analyze">Analyze your profile <ArrowRight size={15} /></Link></Button>
          <div className="mt-6 flex items-center gap-2 border-t pt-4 text-[11px] text-[var(--muted)]"><Target size={14} className="text-[var(--positive)]" />No sample scores or fabricated analytics.</div>
        </div>
      </div>
    </section>
  );
}
