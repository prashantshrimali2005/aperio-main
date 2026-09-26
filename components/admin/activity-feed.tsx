"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatRelative } from "@/lib/utils";
import { ActionLabel } from "@/components/admin/action-label";

type Row = Record<string, unknown>;

const ACTIONS = [
  "auth.register", "auth.login", "auth.login.google", "resume.upload", "resume.rejected",
  "analysis.run", "roadmap.update", "learning_path.generate", "channel.link", "admin.integration.save",
];

export function ActivityFeed({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/admin/activity?limit=120${action ? `&action=${encodeURIComponent(action)}` : ""}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.data) setRows(j.data);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [action]);

  const grouped = useMemo(() => rows, [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Every tracked user and admin action{loading ? " · loading…" : ""}.</p>
        </div>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="h-9 rounded-[9px] border bg-[var(--surface)] px-3 text-xs font-medium">
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="mt-5 overflow-hidden rounded-[14px] border bg-[var(--surface)]">
        {grouped.map((e) => (
          <div key={String(e.id)} className="grid grid-cols-[1fr_auto] items-start gap-3 border-b px-4 py-3 last:border-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ActionLabel action={String(e.action)} />
                {e.userId ? (
                  <Link href={`/admin/users/${e.userId}`} className="text-xs font-medium text-[var(--primary)] hover:underline">{String(e.actor ?? e.email ?? "user")}</Link>
                ) : (
                  <span className="text-xs text-[var(--muted)]">{String(e.actor ?? "system")}</span>
                )}
                {e.entityType ? <span className="text-[11px] text-[var(--muted)]">{String(e.entityType)}</span> : null}
              </div>
              {e.metadata != null && Object.keys(e.metadata as object).length > 0 ? (
                <p className="mt-1 truncate font-mono text-[11px] text-[var(--muted)]">{JSON.stringify(e.metadata)}</p>
              ) : null}
              {Boolean(e.ip || e.userAgent) && (
                <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{String(e.ip ?? "")} · {String(e.userAgent ?? "")}</p>
              )}
            </div>
            <span className="shrink-0 text-xs text-[var(--muted)]">{formatRelative(String(e.createdAt))}</span>
          </div>
        ))}
        {!grouped.length && <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">No events.</p>}
      </div>
    </div>
  );
}
