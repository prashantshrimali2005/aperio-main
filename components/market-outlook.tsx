import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, PlugZap, TrendingUp } from "lucide-react";
import type { MarketOutlook as Outlook, SkillLeverage } from "@/lib/market";

const trendMeta = {
  rising: { icon: ArrowUpRight, color: "var(--positive)", label: "Rising" },
  steady: { icon: Minus, color: "var(--muted)", label: "Steady" },
  declining: { icon: ArrowDownRight, color: "var(--critical)", label: "Declining" },
  unknown: { icon: Minus, color: "var(--muted)", label: "Unknown" },
} as const;

export function MarketOutlook({ leverage, outlook }: { leverage: SkillLeverage[]; outlook: Outlook }) {
  const top = leverage.slice(0, 8);
  const projectionBySkill = new Map(outlook.projections.map((p) => [p.skillId, p]));
  const signalBySkill = new Map(outlook.signals.map((s) => [s.skillId, s]));

  return (
    <section className="mt-5 rounded-[18px] border bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]">Market outlook</p>
          <h2 className="mt-2 text-lg font-semibold">Where these skills sit across roles</h2>
        </div>
        <span className="grid size-10 place-items-center rounded-[11px] bg-[var(--primary-soft)] text-[var(--primary)]"><TrendingUp size={18} /></span>
      </div>

      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
        Leverage is computed from the roles Aperio tracks: how many of them need each skill, and how often it is critical.
        It does not change your match score.
      </p>
      <Link href="/jobs" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)]">
        See live openings that match your skills <ArrowRight size={13} />
      </Link>

      <div className="mt-5 space-y-2">
        {top.map((item) => {
          const projection = projectionBySkill.get(item.skillId);
          const signal = signalBySkill.get(item.skillId);
          return (
            <div key={item.skillId} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b py-2.5 last:border-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{item.name}</span>
                  {item.skillType === "soft" && <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">Soft</span>}
                  {signal && (() => {
                    const meta = trendMeta[signal.trend];
                    const Icon = meta.icon;
                    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: meta.color }}><Icon size={11} />{meta.label}</span>;
                  })()}
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${item.leverageIndex}%` }} />
                </div>
              </div>
              <div className="text-right text-[11px] leading-4 text-[var(--muted)]">
                <div className="font-semibold text-[var(--foreground)]">{item.leverageIndex}</div>
                <div>{item.roleCount} roles · {item.criticalCount} critical</div>
                {projection && <div className="text-[var(--primary)]">~{projection.projectedDemandIndex} in {Math.round(projection.horizonDays / 30)}mo</div>}
              </div>
            </div>
          );
        })}
      </div>

      {!outlook.connected && (
        <div className="mt-4 flex items-start gap-2.5 rounded-[12px] border border-dashed bg-[var(--surface-elevated)] p-3.5 text-xs leading-5 text-[var(--muted)]">
          <PlugZap size={15} className="mt-0.5 shrink-0 text-[var(--muted)]" />
          <span>
            <span className="font-semibold text-[var(--foreground)]">Live demand trends not connected.</span> Aperio shows a real forecast
            only once a job-postings source is ingested (<code>scripts/ingest-market.ts</code>). It does not display estimated market numbers.
          </span>
        </div>
      )}
      {outlook.connected && <p className="mt-4 text-[11px] text-[var(--muted)]">{outlook.note}</p>}
    </section>
  );
}
