"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, ChevronRight, CircleAlert, Fingerprint, Info, Lightbulb, Map, Sparkles, Target } from "lucide-react";
import { ScoreRing } from "@/components/score-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { formatRelative, scoreLabel } from "@/lib/utils";
import { skillLevelLabel, type AnalysisReport as Report, type AnalysisSkill } from "@/lib/types";

const styles = {
  strong: { label: "Strong match", color: "var(--positive)", soft: "var(--positive-soft)", icon: Check },
  developing: { label: "Developing", color: "var(--primary)", soft: "var(--primary-soft)", icon: Sparkles },
  missing: { label: "Not demonstrated", color: "var(--attention)", soft: "var(--attention-soft)", icon: CircleAlert },
};
const importanceLabel = { critical: "Must learn", high: "High impact", medium: "Should improve", optional: "Nice to have" };

function SkillRow({ skill, onOpen }: { skill: AnalysisSkill; onOpen: () => void }) {
  const state = styles[skill.classification]; const Icon = state.icon;
  return <button onClick={onOpen} className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b py-4 text-left last:border-b-0 hover:bg-[var(--surface-elevated)] sm:gap-4 sm:px-2">
    <span className="grid size-9 place-items-center rounded-[10px]" style={{ color: state.color, background: state.soft }}><Icon size={16} /></span>
    <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{skill.name}</span><Badge className="text-[var(--muted)]">{importanceLabel[skill.importance]}</Badge>{skill.skillType === "soft" && <Badge className="border-[var(--primary)] text-[var(--primary)]">Soft skill</Badge>}</span><span className="mt-1 block truncate text-xs text-[var(--muted)]">{skill.evidence[0]?.quote || skill.evidenceBasis || "No clear evidence found in the current profile"}</span></span>
    <span className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]"><span className="hidden sm:inline">{skillLevelLabel[skill.currentLevel]} → {skillLevelLabel[skill.targetLevel]}</span><ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></span>
  </button>;
}

export function AnalysisReport({ report, compact = false }: { report: Report; compact?: boolean }) {
  const [selected, setSelected] = useState<AnalysisSkill | null>(null);
  const topGaps = report.skills.filter((item) => item.classification !== "strong").slice(0, 3);
  const total = Math.max(report.skills.length, 1);
  const coverage = { strong: Math.round(report.matchedCount / total * 100), developing: Math.round(report.developingCount / total * 100), missing: Math.round(report.missingCount / total * 100) };

  return <>
    <div className="grid gap-5 xl:grid-cols-[1.34fr_.66fr]">
      <section className="aperio-panel relative overflow-hidden p-6 sm:p-8">
        <div className="absolute right-0 top-0 size-72 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--primary)_17%,transparent),transparent_70%)]" />
        <div className="relative flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
          <div className="max-w-xl"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]"><Target size={14} />Career match</div><h2 className="mb-0 mt-4 text-2xl font-semibold tracking-[-.035em]">{report.roleTitle}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]"><span className="capitalize">{report.experienceLevel} target</span><span>·</span><span>Analyzed {formatRelative(report.createdAt)}</span></div><p className="mt-5 max-w-lg text-sm leading-6 text-[var(--muted-strong)]">{scoreLabel(report.overallScore)}. Based on the profile evidence currently available to Aperio.</p></div>
          <ScoreRing score={report.overallScore} />
        </div>
        {(report.technicalScore != null || report.softScore != null) && (
          <div className="relative mt-7 grid gap-3 border-t pt-6 sm:grid-cols-2">
            {report.technicalScore != null && (
              <div>
                <div className="flex items-center justify-between text-xs font-medium"><span className="text-[var(--muted)]">Technical readiness</span><span className="font-semibold">{report.technicalScore}%</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${report.technicalScore}%` }} /></div>
              </div>
            )}
            {report.softScore != null && (
              <div>
                <div className="flex items-center justify-between text-xs font-medium"><span className="text-[var(--muted)]">Professional (soft) readiness</span><span className="font-semibold">{report.softScore}%</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--positive)]" style={{ width: `${report.softScore}%` }} /></div>
              </div>
            )}
          </div>
        )}
        <div className="relative mt-6 flex flex-wrap gap-x-8 gap-y-4 border-t pt-6 text-sm"><span><strong className="text-[var(--positive)]">{report.matchedCount}</strong> <span className="text-[var(--muted)]">Matched</span></span><span><strong className="text-[var(--primary)]">{report.developingCount}</strong> <span className="text-[var(--muted)]">Developing</span></span><span><strong className="text-[var(--attention)]">{report.missingCount}</strong> <span className="text-[var(--muted)]">Skill gaps</span></span></div>
      </section>

      <section className="rounded-[22px] border bg-[var(--surface-elevated)] p-6 sm:p-7"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]">Priority focus</p><h2 className="mt-2 text-lg font-semibold">Top gaps to close</h2></div><span className="grid size-10 place-items-center rounded-[11px] bg-[var(--attention-soft)] text-[var(--attention)]"><Lightbulb size={18} /></span></div><div className="mt-5 space-y-1">{topGaps.length ? topGaps.map((skill,index) => <button key={skill.id} onClick={() => setSelected(skill)} className="flex w-full items-center gap-3 border-b py-3 text-left last:border-0"><span className="text-xs font-bold text-[var(--muted)]">0{index+1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{skill.name}</span><span className="text-xs text-[var(--muted)]">{skillLevelLabel[skill.currentLevel]} → {skillLevelLabel[skill.targetLevel]}</span></span><ChevronRight size={15} className="text-[var(--muted)]" /></button>) : <p className="py-8 text-sm text-[var(--muted)]">No priority gaps identified in this analysis.</p>}</div><Button asChild variant="secondary" className="mt-5 w-full"><Link href="/roadmap">View roadmap <ArrowRight size={15} /></Link></Button></section>
    </div>

    {!compact && <>
      <section className="mt-5 rounded-[18px] border bg-[var(--surface)] p-5 sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]">Skill coverage</p><h2 className="mt-2 text-lg font-semibold">How your evidence maps to this role</h2></div><div className="flex flex-wrap gap-4 text-xs text-[var(--muted)]"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[var(--positive)]" />Strong {coverage.strong}%</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[var(--primary)]" />Developing {coverage.developing}%</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[var(--attention)]" />Missing {coverage.missing}%</span></div></div><div role="img" className="mt-5 flex h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]" aria-label={`Skill coverage: ${coverage.strong}% strong, ${coverage.developing}% developing, ${coverage.missing}% missing`}><div style={{ width: `${coverage.strong}%` }} className="bg-[var(--positive)]" /><div style={{ width: `${coverage.developing}%` }} className="bg-[var(--primary)]" /><div style={{ width: `${coverage.missing}%` }} className="bg-[var(--attention)]" /></div></section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[.72fr_1.28fr]"><div className="rounded-[18px] border bg-[var(--primary-soft)] p-6"><span className="grid size-10 place-items-center rounded-[11px] bg-[var(--surface)] text-[var(--primary)]"><Fingerprint size={18} /></span><p className="mt-5 text-xs font-semibold uppercase tracking-[.14em] text-[var(--primary)]">Aperio summary</p><p className="mt-3 text-[15px] leading-7 text-[var(--muted-strong)]">{report.summary}</p><p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]"><Info size={14} className="mt-0.5 shrink-0" />This is guidance based on current evidence, not an absolute assessment of your ability.</p></div><div className="rounded-[18px] border bg-[var(--surface)] p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]">Skill matrix</p><h2 className="mt-2 text-lg font-semibold">Evidence and expected level</h2></div><Badge className="text-[var(--muted)]">{report.skills.length} requirements</Badge></div><div className="mt-3">{report.skills.map((skill) => <SkillRow key={skill.id} skill={skill} onOpen={() => setSelected(skill)} />)}</div></div></section>
    </>}

    <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent title={selected?.name}>{selected && <div className="pt-7"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[12px]" style={{ color: styles[selected.classification].color, background: styles[selected.classification].soft }}>{(() => { const Icon = styles[selected.classification].icon; return <Icon size={19} />; })()}</span><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--muted)]">{selected.category}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.03em]">{selected.name}</h2></div></div><div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-[13px] border bg-[var(--border)]"><div className="bg-[var(--surface-elevated)] p-4"><p className="text-xs text-[var(--muted)]">Current inference</p><p className="mt-1 font-semibold">{skillLevelLabel[selected.currentLevel]}</p></div><div className="bg-[var(--surface-elevated)] p-4"><p className="text-xs text-[var(--muted)]">Role target</p><p className="mt-1 font-semibold">{skillLevelLabel[selected.targetLevel]}</p></div><div className="bg-[var(--surface-elevated)] p-4"><p className="text-xs text-[var(--muted)]">Importance</p><p className="mt-1 font-semibold">{importanceLabel[selected.importance]}</p></div><div className="bg-[var(--surface-elevated)] p-4"><p className="text-xs text-[var(--muted)]">Confidence</p><p className="mt-1 font-semibold">{Math.round(Number(selected.confidence) * 100)}%</p></div></div><div className="mt-8"><h3 className="flex items-center gap-2 text-sm font-semibold"><Fingerprint size={16} className="text-[var(--primary)]" />Evidence</h3>{selected.evidenceBasis && <p className="mt-2 inline-flex rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--muted-strong)]">{selected.evidenceBasis}</p>}{selected.evidence.length ? <div className="mt-3 space-y-3">{selected.evidence.map((item,index) => <blockquote key={index} className="m-0 rounded-[12px] border bg-[var(--surface-elevated)] p-4 text-sm leading-6 text-[var(--muted-strong)]"><p>“{item.quote}”</p><footer className="mt-2 text-xs font-medium text-[var(--muted)]">{item.source}</footer></blockquote>)}</div> : <p className="mt-3 rounded-[12px] bg-[var(--attention-soft)] p-4 text-sm leading-6 text-[var(--muted-strong)]">This skill was not clearly identified in your current resume or profile. That does not necessarily mean you do not have it.</p>}</div><div className="mt-8"><h3 className="flex items-center gap-2 text-sm font-semibold"><BookOpen size={16} className="text-[var(--primary)]" />Why it matters</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{selected.whyItMatters}</p></div><div className="mt-8 rounded-[14px] bg-[var(--primary-soft)] p-5"><h3 className="flex items-center gap-2 text-sm font-semibold"><Map size={16} className="text-[var(--primary)]" />Recommended next step</h3><p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">{selected.recommendation}</p></div><Button asChild className="mt-8 w-full"><Link href="/skills">Review or correct this skill</Link></Button></div>}</SheetContent></Sheet>
  </>;
}
