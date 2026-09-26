"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Briefcase, Building2, ExternalLink, LoaderCircle, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils";

type Job = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean;
  url: string | null;
  sourceName: string;
  descriptionPreview: string | null;
  matchedSkills: string[];
  totalSkills: number;
  capturedAt: string;
  postedAt: string | null;
};

const scopes = [
  { key: "all", label: "All my skills" },
  { key: "have", label: "Skills I have" },
  { key: "target", label: "My target role" },
] as const;

export function JobsBoard({ initial }: { initial: { jobs: Job[]; total: number; matchedAgainst: number } }) {
  const [scope, setScope] = useState<"all" | "have" | "target">("all");
  const [remote, setRemote] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/jobs?scope=${scope}${remote ? "&remote=1" : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      const json = await res.json();
      if (res.ok) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [scope, remote, q]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-[var(--primary)]">Jobs for you</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Openings that match your skills</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Real postings pulled from public job boards, ranked by how many of your skills they ask for. Matched against{" "}
          <b className="text-[var(--foreground)]">{data.matchedAgainst}</b> of your skills.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Match scope" className="flex gap-1 rounded-[10px] border bg-[var(--surface)] p-1 text-xs font-medium">
          {scopes.map((s) => (
            <button key={s.key} type="button" aria-pressed={scope === s.key} onClick={() => setScope(s.key)} className={cn("rounded-[7px] px-2.5 py-1 transition-colors", scope === s.key ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]" : "text-[var(--muted)] hover:text-[var(--foreground)]")}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 rounded-[10px] border bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium">
          <input type="checkbox" className="size-3.5 accent-[var(--primary)]" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
          Remote only
        </label>
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          {loading && <LoaderCircle size={13} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--muted)]" />}
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, company, location" aria-label="Search jobs by title, company, or location" className="h-9 pl-9 text-xs" />
        </div>
        <span className="text-xs text-[var(--muted)]" aria-live="polite">{data.total} matches</span>
      </div>

      <div className="mt-5 grid gap-3" aria-busy={loading}>
        {data.jobs.map((job) => (
          <article key={job.id} className="rounded-[16px] border bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold">{job.title}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                  {job.company && <span className="inline-flex items-center gap-1"><Building2 size={12} />{job.company}</span>}
                  {(job.location || job.remote) && <span className="inline-flex items-center gap-1"><MapPin size={12} />{job.remote ? "Remote" : job.location}</span>}
                  <span>{formatRelative(job.postedAt || job.capturedAt)}</span>
                  <span className="text-[var(--muted)]">· {job.sourceName}</span>
                </p>
              </div>
              {job.url && (
                <a href={job.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-[9px] bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white">
                  Apply <ExternalLink size={12} />
                </a>
              )}
            </div>

            {job.matchedSkills.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--positive)]">{job.matchedSkills.length}/{job.totalSkills} of your skills</span>
                {job.matchedSkills.slice(0, 8).map((s) => (
                  <span key={s} className="rounded-md bg-[var(--positive-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--positive)]">{s}</span>
                ))}
              </div>
            )}

            {job.descriptionPreview && <p className="mt-2.5 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{job.descriptionPreview}…</p>}
          </article>
        ))}

        {!data.jobs.length && (
          <div className="rounded-[16px] border bg-[var(--surface)] px-6 py-14 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-[13px] bg-[var(--primary-soft)] text-[var(--primary)]"><Briefcase size={20} /></span>
            <p className="mt-4 text-sm text-[var(--muted)]">
              {data.matchedAgainst === 0
                ? "Run an analysis or fill your skill profile so Aperio knows what to match."
                : "No matching postings yet. An admin ingests job boards under Admin → Job market; check back after the next run."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
