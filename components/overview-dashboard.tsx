"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  Fingerprint,
  Map,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { ScoreRing } from "@/components/score-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn, formatDate, formatRelative, scoreLabel } from "@/lib/utils";
import { skillLevelLabel, type AnalysisReport, type AnalysisSkill } from "@/lib/types";

type RoadmapItem = {
  id: string;
  skillName: string;
  status: "not_started" | "in_progress" | "completed";
  effort: string;
  priority: string;
};

type HistoryItem = {
  id: string;
  overallScore: number;
  roleTitle: string;
  createdAt: string;
};

const classification = {
  strong: { label: "Strong match", color: "var(--positive)", soft: "var(--positive-soft)", icon: Check },
  developing: { label: "Developing", color: "var(--primary)", soft: "var(--primary-soft)", icon: Sparkles },
  missing: { label: "Not demonstrated", color: "var(--attention)", soft: "var(--attention-soft)", icon: CircleAlert },
};

const importance = { critical: "Must learn", high: "High impact", medium: "Should improve", optional: "Nice to have" } as const;

function PanelHeader({ icon: Icon, title, action, href, tone = "primary" }: { icon: typeof Target; title: string; action?: string; href?: string; tone?: "primary" | "positive" | "attention" }) {
  const color = tone === "positive" ? "text-[var(--positive)]" : tone === "attention" ? "text-[var(--attention)]" : "text-[var(--primary)]";
  return <div className="flex items-center justify-between gap-4 border-b px-5 py-4"><h2 className="flex items-center gap-2 text-[13px] font-semibold"><Icon size={16} className={color} />{title}</h2>{action && href && <Link href={href} className="flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)] transition hover:text-[var(--primary-strong)]">{action}<ArrowRight size={13} /></Link>}</div>;
}

function SkillDots({ level }: { level: number }) {
  return <span className="flex items-center gap-1" aria-label={`${skillLevelLabel[level]} proficiency`}>{[0, 1, 2, 3, 4].map((dot) => <i key={dot} className={cn("block size-2.5 rounded-full border", dot <= level ? "border-[var(--positive)] bg-[var(--positive)]" : "border-[var(--border-strong)] bg-transparent")} />)}</span>;
}

export function OverviewDashboard({ report, roadmapItems, history }: { report: AnalysisReport; roadmapItems: RoadmapItem[]; history: HistoryItem[] }) {
  const [selected, setSelected] = useState<AnalysisSkill | null>(null);
  const total = Math.max(report.skills.length, 1);
  const coverage = {
    strong: Math.round((report.matchedCount / total) * 100),
    developing: Math.round((report.developingCount / total) * 100),
    missing: Math.round((report.missingCount / total) * 100),
  };
  const strongSkills = report.skills.filter((skill) => skill.classification === "strong").slice(0, 5);
  const topGaps = report.skills.filter((skill) => skill.classification !== "strong").slice(0, 3);
  const scoreColor = report.overallScore >= 75 ? "text-[var(--positive)]" : report.overallScore >= 55 ? "text-[var(--primary)]" : "text-[var(--attention)]";
  const roleHistory = history.filter((item) => item.roleTitle === report.roleTitle).slice(0, 4).reverse();

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_.72fr_1fr]">
        <section className="aperio-panel relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-[color-mix(in_srgb,var(--positive)_9%,transparent)] blur-3xl" />
          <p className="relative text-[12px] font-semibold">Career Match</p>
          <div className="relative mt-4 flex items-center justify-between gap-5">
            <div>
              <p className={cn("text-5xl font-semibold tracking-[-.06em]", scoreColor)}>{report.overallScore}%</p>
              <p className={cn("mt-2 text-sm font-semibold", scoreColor)}>{scoreLabel(report.overallScore)}</p>
              <p className="mt-4 max-w-[220px] text-xs leading-5 text-[var(--muted-strong)]">{report.matchedCount} of {report.skills.length} required skills are strongly demonstrated for this target.</p>
            </div>
            <ScoreRing score={report.overallScore} size="md" />
          </div>
        </section>

        <section className="aperio-panel p-5 sm:p-6">
          <p className="text-[12px] font-semibold">Skill Summary</p>
          <div className="mt-5 space-y-4">
            {[
              [report.matchedCount, "Matched skills", "var(--positive)"],
              [report.missingCount, "Skill gaps", "var(--attention)"],
              [report.developingCount, "Developing skills", "var(--primary)"],
            ].map(([value, label, color]) => <div key={String(label)} className="flex items-center gap-3"><i className="size-3 shrink-0 rounded-full" style={{ background: String(color) }} /><div><p className="text-lg font-semibold leading-none">{String(value)}</p><p className="mt-1 text-xs text-[var(--muted)]">{String(label)}</p></div></div>)}
          </div>
        </section>

        <section className="aperio-panel p-5 sm:p-6">
          <p className="text-[12px] font-semibold">Analysis Context</p>
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3"><BriefcaseBusiness size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" /><div><p className="text-xs font-semibold">{report.roleTitle}</p><p className="mt-1 text-[11px] capitalize text-[var(--muted)]">{report.experienceLevel} level target</p></div></div>
            <div className="flex items-start gap-3"><CalendarDays size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" /><div><p className="text-xs font-semibold">Analyzed {formatRelative(report.createdAt)}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{formatDate(report.createdAt)}</p></div></div>
            {report.resumeFilename && <div className="flex items-start gap-3"><FileCheck2 size={16} className="mt-0.5 shrink-0 text-[var(--positive)]" /><div className="min-w-0"><p className="truncate text-xs font-semibold">{report.resumeFilename}</p><p className="mt-1 text-[11px] text-[var(--muted)]">Verified evidence source</p></div></div>}
          </div>
          <Link href={`/history/${report.id}`} className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">View full report <ArrowRight size={13} /></Link>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_.92fr]">
        <section className="aperio-panel overflow-hidden">
          <PanelHeader icon={Target} title="Skill Coverage" />
          <div className="p-5 sm:p-6">
            <div role="img" className="flex h-9 overflow-hidden rounded-[7px] bg-[var(--surface-muted)] text-[11px] font-semibold text-white" aria-label={`${coverage.strong}% strong match, ${coverage.developing}% developing, ${coverage.missing}% missing`}>
              {coverage.strong > 0 && <div className="grid place-items-center bg-[var(--positive)]" style={{ width: `${coverage.strong}%` }}>{coverage.strong >= 12 && `${coverage.strong}%`}</div>}
              {coverage.missing > 0 && <div className="grid place-items-center bg-[var(--attention)]" style={{ width: `${coverage.missing}%` }}>{coverage.missing >= 12 && `${coverage.missing}%`}</div>}
              {coverage.developing > 0 && <div className="grid place-items-center bg-[var(--primary)]" style={{ width: `${coverage.developing}%` }}>{coverage.developing >= 12 && `${coverage.developing}%`}</div>}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ["Strong match", report.matchedCount, "var(--positive)"],
                ["Not demonstrated", report.missingCount, "var(--attention)"],
                ["Developing", report.developingCount, "var(--primary)"],
              ].map(([label, value, color]) => <div key={String(label)} className="flex items-start gap-2.5"><i className="mt-1 size-2.5 rounded-full" style={{ background: String(color) }} /><div><p className="text-xs font-semibold">{String(label)}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{String(value)} skills</p></div></div>)}
            </div>
            {roleHistory.length > 1 ? <div className="mt-6 flex items-center gap-2 border-t pt-4 text-[11px] text-[var(--muted)]"><Route size={14} className="text-[var(--primary)]" /><span>Recent {report.roleTitle} scores:</span>{roleHistory.map((item, index) => <span key={item.id} className="font-semibold text-[var(--foreground)]">{item.overallScore}%{index < roleHistory.length - 1 && <span className="ml-2 text-[var(--muted)]">→</span>}</span>)}</div> : <p className="mt-6 border-t pt-4 text-[11px] text-[var(--muted)]">Analyze this role again later to reveal a real progress trend.</p>}
          </div>
        </section>

        <section className="aperio-panel overflow-hidden">
          <PanelHeader icon={CircleAlert} title="Top Skill Gaps" tone="attention" action="View all gaps" href={`/history/${report.id}`} />
          <div className="px-5">
            {topGaps.length ? topGaps.map((skill, index) => <button key={skill.id} onClick={() => setSelected(skill)} className="group flex w-full items-center gap-3 border-b py-3.5 text-left last:border-0"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] text-[11px] font-semibold text-[var(--muted-strong)]">{index + 1}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold">{skill.name}</span><span className="rounded-[5px] bg-[var(--attention-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--attention)]">{importance[skill.importance]}</span></span><span className="mt-1 block truncate text-[11px] text-[var(--muted)]">{skill.whyItMatters}</span></span><ChevronRight size={14} className="text-[var(--muted)] transition group-hover:translate-x-0.5" /></button>) : <div className="py-10 text-center"><ShieldCheck className="mx-auto text-[var(--positive)]" size={21} /><p className="mt-3 text-xs text-[var(--muted)]">No priority gaps in this analysis.</p></div>}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_.92fr]">
        <section className="aperio-panel overflow-hidden">
          <PanelHeader icon={Check} title="Strong Skills" tone="positive" action="View skill profile" href="/skills" />
          {strongSkills.length ? <div className="overflow-x-auto scrollbar-none"><div className="min-w-[610px]"><div className="grid grid-cols-[1.1fr_.75fr_.9fr_1fr_22px] gap-3 border-b bg-[var(--surface-elevated)] px-5 py-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[var(--muted)]"><span>Skill</span><span>Category</span><span>Proficiency</span><span>Evidence</span><span /></div>{strongSkills.map((skill) => <button key={skill.id} onClick={() => setSelected(skill)} className="group grid w-full grid-cols-[1.1fr_.75fr_.9fr_1fr_22px] items-center gap-3 border-b px-5 py-3 text-left last:border-0 hover:bg-[var(--surface-elevated)]"><span className="truncate text-xs font-semibold">{skill.name}</span><span className="truncate text-[11px] text-[var(--muted)]">{skill.category}</span><SkillDots level={skill.currentLevel} /><span className="truncate text-[11px] text-[var(--muted)]">{[...new Set(skill.evidence.map((item) => item.source))].join(", ") || "Profile evidence"}</span><ChevronRight size={14} className="text-[var(--muted)] transition group-hover:translate-x-0.5" /></button>)}</div></div> : <p className="px-5 py-10 text-center text-xs text-[var(--muted)]">No strong matches were demonstrated yet.</p>}
        </section>

        <section className="aperio-panel overflow-hidden">
          <PanelHeader icon={Route} title="Your Next Steps" action="View full roadmap" href="/roadmap" />
          {roadmapItems.length ? <div className="px-5">{roadmapItems.slice(0, 4).map((item, index) => <div key={item.id} className="relative flex gap-3 pb-3.5 pt-3.5 before:absolute before:bottom-0 before:left-[13px] before:top-10 before:w-px before:bg-[var(--border)] last:before:hidden"><span className={cn("relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold", item.status === "completed" ? "bg-[var(--positive)] text-white" : item.status === "in_progress" ? "bg-[var(--primary)] text-white" : "border bg-[var(--surface-muted)] text-[var(--muted-strong)]")}>{item.status === "completed" ? <Check size={13} /> : index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{item.skillName}</p><p className="mt-1 line-clamp-1 text-[11px] capitalize text-[var(--muted)]">{item.status.replace("_", " ")} · {item.effort}</p></div><Badge className="h-fit border-0 bg-[var(--primary-soft)] px-1.5 py-1 text-[9px] text-[var(--primary)]">{item.priority}</Badge></div>)}</div> : <div className="px-5 py-10 text-center"><Map className="mx-auto text-[var(--primary)]" size={20} /><p className="mt-3 text-xs text-[var(--muted)]">No roadmap steps are available.</p></div>}
        </section>
      </div>

      <section className="mt-4 flex flex-col gap-4 rounded-[16px] border bg-[var(--primary-faint)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl"><p className="flex items-center gap-2 text-xs font-semibold"><Fingerprint size={15} className="text-[var(--primary)]" />Aperio’s evidence-based summary</p><p className="mt-2 text-xs leading-5 text-[var(--muted-strong)]">{report.summary}</p></div><Button asChild variant="secondary" className="shrink-0"><Link href={`/history/${report.id}`}>Why this result? <ArrowRight size={14} /></Link></Button>
      </section>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent title={selected?.name}>
          {selected && <SkillDetail skill={selected} reportId={report.id} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function SkillDetail({ skill, reportId }: { skill: AnalysisSkill; reportId: string }) {
  const state = classification[skill.classification];
  const Icon = state.icon;
  return <div className="pt-6"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[12px]" style={{ color: state.color, background: state.soft }}><Icon size={19} /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--muted)]">{skill.category}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.03em]">{skill.name}</h2></div></div><Badge className="mt-4" style={{ color: state.color, background: state.soft, borderColor: "transparent" }}>{state.label}</Badge><div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border bg-[var(--border)]"><div className="bg-[var(--surface-elevated)] p-4"><p className="text-[10px] text-[var(--muted)]">Current level</p><p className="mt-1 text-sm font-semibold">{skillLevelLabel[skill.currentLevel]}</p></div><div className="bg-[var(--surface-elevated)] p-4"><p className="text-[10px] text-[var(--muted)]">Role target</p><p className="mt-1 text-sm font-semibold">{skillLevelLabel[skill.targetLevel]}</p></div><div className="bg-[var(--surface-elevated)] p-4"><p className="text-[10px] text-[var(--muted)]">Priority</p><p className="mt-1 text-sm font-semibold">{importance[skill.importance]}</p></div><div className="bg-[var(--surface-elevated)] p-4"><p className="text-[10px] text-[var(--muted)]">Confidence</p><p className="mt-1 text-sm font-semibold">{Math.round(Number(skill.confidence) * 100)}%</p></div></div><div className="mt-7"><h3 className="flex items-center gap-2 text-sm font-semibold"><Fingerprint size={15} className="text-[var(--primary)]" />Evidence</h3>{skill.evidence.length ? <div className="mt-3 space-y-3">{skill.evidence.map((item, index) => <blockquote key={index} className="rounded-[11px] border bg-[var(--surface-elevated)] p-4 text-xs leading-5 text-[var(--muted-strong)]">“{item.quote}”<footer className="mt-2 text-[10px] font-semibold text-[var(--muted)]">{item.source}</footer></blockquote>)}</div> : <p className="mt-3 rounded-[11px] bg-[var(--attention-soft)] p-4 text-xs leading-5 text-[var(--muted-strong)]">This skill was not clearly demonstrated in the current profile. That is not a claim that you do not know it.</p>}</div><div className="mt-7"><h3 className="flex items-center gap-2 text-sm font-semibold"><BookOpen size={15} className="text-[var(--primary)]" />Recommended next step</h3><p className="mt-3 text-xs leading-5 text-[var(--muted-strong)]">{skill.recommendation}</p></div><Button asChild className="mt-7 w-full"><Link href={`/history/${reportId}`}>Open full evidence report</Link></Button></div>;
}
