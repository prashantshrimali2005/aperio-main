"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, LoaderCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatRelative } from "@/lib/utils";

type Row = Record<string, unknown>;

export function UserTable({ initial }: { initial: { rows: Row[]; total: number } }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/admin/users?q=${encodeURIComponent(q)}&limit=60`);
        const json = await res.json();
        if (res.ok) setData(json.data);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{data.total.toLocaleString()} total</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          {loading && <LoaderCircle size={14} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--muted)]" />}
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" aria-label="Search users by name or email" className="pl-9" />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[14px] border bg-[var(--surface)]" aria-busy={loading}>
        <div className="hidden grid-cols-[1.6fr_1fr_repeat(4,minmax(0,64px))_auto] gap-3 border-b bg-[var(--surface-elevated)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] lg:grid">
          <span>User</span><span>Last seen</span><span className="text-right">Anlys</span><span className="text-right">CVs</span><span className="text-right">Plans</span><span className="text-right">Chans</span><span />
        </div>
        {data.rows.map((u) => (
          <Link
            key={String(u.id)}
            href={`/admin/users/${u.id}`}
            className="grid grid-cols-[1fr_auto] items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-[var(--surface-elevated)] lg:grid-cols-[1.6fr_1fr_repeat(4,minmax(0,64px))_auto]"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{String(u.fullName)}</span>
                {u.role === "admin" && <span className="rounded bg-[var(--primary-soft)] px-1.5 text-[10px] font-semibold text-[var(--primary)]">admin</span>}
              </span>
              <span className="block truncate text-xs text-[var(--muted)]">{String(u.email)} · {String(u.authProvider ?? "password")}</span>
            </span>
            <span className="hidden text-xs text-[var(--muted)] lg:block">{u.lastSeenAt ? formatRelative(String(u.lastSeenAt)) : "—"}</span>
            <span className="hidden text-right text-sm tabular-nums lg:block">{Number(u.analyses)}</span>
            <span className="hidden text-right text-sm tabular-nums lg:block">{Number(u.resumes)}</span>
            <span className="hidden text-right text-sm tabular-nums lg:block">{Number(u.learningPaths)}</span>
            <span className="hidden text-right text-sm tabular-nums lg:block">{Number(u.linkedChannels)}</span>
            <ChevronRight size={16} className="justify-self-end text-[var(--muted)]" />
          </Link>
        ))}
        {!data.rows.length && <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">No users match.</p>}
      </div>
    </div>
  );
}
