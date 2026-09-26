import Link from "next/link";
import { ArrowRight, Check, ChevronRight, FileSearch, Fingerprint, Map, Target } from "lucide-react";
import { AperioBrand } from "@/components/aperio-brand";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return <main className="min-h-screen overflow-hidden bg-[var(--background)]">
    <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
      <AperioBrand />
      <nav className="flex items-center gap-2"><Button asChild variant="ghost"><Link href="/login">Sign in</Link></Button><Button asChild><Link href="/register">Get started <ArrowRight size={15} /></Link></Button></nav>
    </header>

    <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid lg:grid-cols-[1fr_.92fr] lg:items-center lg:gap-16 lg:pb-28">
      <div className="absolute left-[5%] top-0 -z-0 size-[440px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_70%)]" />
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full border bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted-strong)]"><Fingerprint size={14} className="text-[var(--primary)]" /> Evidence-based career analysis</div>
        <h1 className="mt-7 max-w-3xl text-balance text-5xl font-semibold tracking-[-.055em] sm:text-6xl lg:text-7xl">Turn your experience into a clearer next move.</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">Aperio maps what your profile demonstrates, what your target role expects, and which gap is worth closing first.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg"><Link href="/register">Analyze your profile <ArrowRight size={16} /></Link></Button><Button asChild variant="secondary" size="lg"><Link href="/login">Continue to workspace</Link></Button></div>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--muted)]">{["Explainable skill evidence","Role-specific readiness","Progress that persists"].map((item) => <span key={item} className="flex items-center gap-2"><Check size={15} className="text-[var(--positive)]" />{item}</span>)}</div>
      </div>

      <div className="relative z-10 mt-16 lg:mt-0">
        <div className="overflow-hidden rounded-[24px] border bg-[var(--surface)] shadow-[var(--shadow)]">
          <div className="flex items-center justify-between border-b px-6 py-5"><div><p className="m-0 text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--muted)]">Analysis preview</p><p className="mt-1 text-sm font-semibold">Your data appears here</p></div><span className="grid size-9 place-items-center rounded-[10px] bg-[var(--primary-soft)] text-[var(--primary)]"><Target size={17} /></span></div>
          <div className="grid sm:grid-cols-[.88fr_1.12fr]">
            <div className="border-b p-7 sm:border-b-0 sm:border-r"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--muted)]">Career match</p><div className="mt-7 text-6xl font-semibold tracking-[-.07em]">—</div><p className="mt-2 text-sm text-[var(--muted)]">Calculated from your profile</p><div className="mt-8 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]" /></div>
            <div className="bg-[var(--surface-elevated)] p-7"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--muted)]">What Aperio reveals</p><div className="mt-5 space-y-4">{[[FileSearch,"Evidence behind each skill"],[Target,"Highest-impact gaps"],[Map,"Personalized learning sequence"]].map(([Icon,label]) => { const C = Icon as typeof FileSearch; return <div key={String(label)} className="flex items-center gap-3 border-b pb-4 last:border-0 last:pb-0"><span className="grid size-9 place-items-center rounded-[10px] bg-[var(--surface)] text-[var(--primary)]"><C size={17} /></span><span className="text-sm font-medium">{String(label)}</span><ChevronRight size={15} className="ml-auto text-[var(--muted)]" /></div>; })}</div></div>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-[var(--muted)]">No sample score is shown. Your workspace starts clean.</p>
      </div>
    </section>

    <section className="border-t bg-[var(--surface)]"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-3">{[["01","See what is actually demonstrated","Aperio connects inferred skills to specific resume or profile evidence so you can verify the reasoning."],["02","Compare against the right level","Junior, mid, and senior targets use different expectations instead of one generic skill list."],["03","Act on the gap that matters","A phased roadmap prioritizes role impact while keeping mastery claims grounded in evidence."]].map(([n,title,copy]) => <div key={n} className="border-t pt-5"><span className="text-xs font-bold text-[var(--primary)]">{n}</span><h2 className="mb-2 mt-4 text-lg font-semibold tracking-[-.02em]">{title}</h2><p className="m-0 text-sm leading-6 text-[var(--muted)]">{copy}</p></div>)}</div></section>
  </main>;
}
