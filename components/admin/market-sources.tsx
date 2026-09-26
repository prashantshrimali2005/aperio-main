"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRelative } from "@/lib/utils";

type Source = Record<string, unknown>;
type IntKey = { key: string; title: string };
type Stats = {
  totals: { totalPostings: number; withSkills: number; remote: number; lastCaptured: string | null } | null;
  topSkills: Array<{ name: string; postings: number }>;
  bySource: Array<{ sourceName: string; postings: number; lastCaptured: string }>;
};

const blank = { name: "", kind: "api", weight: 1, integrationKey: "", region: "global", enabled: true };

function SourceRow({
  row,
  isDraft,
  integrationKeys,
  saving,
  onChange,
  onSave,
  onRemove,
}: {
  row: Record<string, unknown>;
  isDraft?: boolean;
  integrationKeys: IntKey[];
  saving: boolean;
  onChange: (patch: Record<string, unknown>) => void;
  onSave: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="grid gap-2 border-b px-3 py-3 last:border-0 sm:grid-cols-[1.4fr_.8fr_.7fr_1fr_.6fr_auto] sm:items-center">
      <Input value={String(row.name ?? "")} onChange={(e) => onChange({ name: e.target.value })} placeholder="Source name" />
      <select value={String(row.kind ?? "api")} onChange={(e) => onChange({ kind: e.target.value })} className="h-10 rounded-[9px] border bg-[var(--surface-elevated)] px-2 text-xs">
        {["api", "agency", "manual"].map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <label className="flex items-center gap-1.5 text-xs">
        w
        <Input type="number" step="0.5" min="0" max="10" value={String(row.weight ?? 1)} onChange={(e) => onChange({ weight: e.target.value })} className="w-16" />
      </label>
      <select value={String(row.integrationKey ?? "")} onChange={(e) => onChange({ integrationKey: e.target.value })} className="h-10 rounded-[9px] border bg-[var(--surface-elevated)] px-2 text-xs">
        <option value="">no API creds</option>
        {integrationKeys.map((k) => <option key={k.key} value={k.key}>{k.title}</option>)}
      </select>
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={Boolean(row.enabled)} onChange={(e) => onChange({ enabled: e.target.checked })} />on</label>
      <div className="flex gap-1.5">
        <Button size="sm" onClick={onSave} disabled={saving || !String(row.name ?? "").trim()}>
          {saving ? <LoaderCircle size={13} className="animate-spin" /> : isDraft ? <Plus size={13} /> : <Check size={13} />}
        </Button>
        {!isDraft && onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${String(row.name ?? "source")}`} className="grid size-8 place-items-center rounded-[8px] text-[var(--muted)] hover:text-[var(--critical)]"><Trash2 size={13} /></button>}
      </div>
    </div>
  );
}

export function MarketSources({ initial }: { initial: { sources: Source[]; integrationKeys: IntKey[]; stats: Stats } }) {
  const [sources, setSources] = useState(initial.sources);
  const [draft, setDraft] = useState<Record<string, unknown>>(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Stats>(initial.stats);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState("");

  async function runIngestion() {
    setIngesting(true);
    setIngestMsg("");
    try {
      const res = await fetch("/api/v1/admin/jobs", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Ingestion failed.");
      setStats(json.data.stats);
      const r = json.data.result;
      setIngestMsg(`Done — ${r.postings ?? 0} postings, ${r.observations ?? 0} demand points from ${r.sources ?? 0} source(s).`);
    } catch (err) {
      setIngestMsg(err instanceof Error ? err.message : "Ingestion failed.");
    } finally {
      setIngesting(false);
    }
  }

  async function save(row: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/v1/admin/market/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...row, weight: Number(row.weight), integrationKey: row.integrationKey || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Save failed.");
      setSources((s) => {
        const exists = s.some((x) => x.id === json.data.id);
        return exists ? s.map((x) => (x.id === json.data.id ? json.data : x)) : [...s, json.data];
      });
      if (!row.id) setDraft(blank);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove the “${name}” job source?`)) return;
    const prev = sources;
    setSources((s) => s.filter((x) => x.id !== id));
    const res = await fetch(`/api/v1/admin/market/sources/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setSources(prev);
      setError("Couldn’t remove that source. Try again.");
    }
  }

  const t = stats?.totals;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job market</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Each source below is a real job board Aperio scans. Ingestion does two things: (1) stores the actual openings, which users
          see on their <b className="text-[var(--foreground)]">Jobs</b> page ranked by skill overlap, and (2) counts how often each
          skill appears, which powers the demand outlook on analysis reports. Higher weight = more say in the blended demand index.
          Arbeitnow needs no key; other providers take credentials under{" "}
          <Link href="/admin/integrations" className="font-medium text-[var(--primary)]">Integrations</Link>.
        </p>
      </div>

      <section className="rounded-[14px] border bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><b className="tabular-nums">{Number(t?.totalPostings ?? 0)}</b> <span className="text-[var(--muted)]">postings</span></span>
            <span><b className="tabular-nums">{Number(t?.withSkills ?? 0)}</b> <span className="text-[var(--muted)]">with skill matches</span></span>
            <span><b className="tabular-nums">{Number(t?.remote ?? 0)}</b> <span className="text-[var(--muted)]">remote</span></span>
            <span className="text-[var(--muted)]">last run: {t?.lastCaptured ? formatRelative(t.lastCaptured) : "never"}</span>
          </div>
          <Button size="sm" onClick={runIngestion} disabled={ingesting}>
            {ingesting ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />}Run ingestion now
          </Button>
        </div>
        {ingestMsg && <p className="mt-2 text-xs text-[var(--muted-strong)]">{ingestMsg}</p>}
        {stats?.topSkills?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stats.topSkills.map((s) => (
              <span key={s.name} className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--muted-strong)]">{s.name} · {s.postings}</span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="overflow-hidden rounded-[14px] border bg-[var(--surface)]">
        <div className="hidden grid-cols-[1.4fr_.8fr_.7fr_1fr_.6fr_auto] gap-2 border-b bg-[var(--surface-elevated)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] sm:grid">
          <span>Name</span><span>Kind</span><span>Weight</span><span>API creds</span><span>On</span><span />
        </div>
        {sources.map((s) => (
          <SourceRow
            key={String(s.id)}
            row={s}
            integrationKeys={initial.integrationKeys}
            saving={saving}
            onChange={(patch) => setSources((list) => list.map((x) => (x.id === s.id ? { ...x, ...patch } : x)))}
            onSave={() => save(s)}
            onRemove={() => remove(String(s.id), String(s.name ?? "this source"))}
          />
        ))}
        <SourceRow
          row={draft}
          isDraft
          integrationKeys={initial.integrationKeys}
          saving={saving}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onSave={() => save(draft)}
        />
      </div>
      {error && <p className="text-sm text-[var(--critical)]">{error}</p>}

      <p className="text-xs text-[var(--muted)]">
        Ingestion runs automatically once a day (Vercel cron), on demand with the button above, or via
        <code> npm run market:ingest</code>. Nothing is fabricated — a source with no reachable data writes nothing, and the
        demand forecast needs at least two dated runs.
      </p>
    </div>
  );
}
