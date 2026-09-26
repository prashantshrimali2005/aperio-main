"use client";

import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRelative } from "@/lib/utils";
import { ActionLabel } from "@/components/admin/action-label";

type Overview = {
  totals: Record<string, number>;
  daily: Array<{ label: string; signups: number; analyses: number; events: number }>;
  topActions: Array<{ action: string; count: number }>;
  recentUsers: Array<Record<string, unknown>>;
  recentActivity: Array<Record<string, unknown>>;
};

const kpis: Array<{ key: string; label: string }> = [
  { key: "users", label: "Total users" },
  { key: "newUsers7d", label: "New (7d)" },
  { key: "active7d", label: "Active (7d)" },
  { key: "analyses", label: "Analyses" },
  { key: "analyses7d", label: "Analyses (7d)" },
  { key: "resumes", label: "Résumés" },
  { key: "learningPaths", label: "Course plans" },
  { key: "linkedChannels", label: "Linked channels" },
  { key: "notificationsSent", label: "Messages sent" },
  { key: "events24h", label: "Events (24h)" },
];

export function AdminOverview({ data }: { data: Overview }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Usage, growth, and what people are doing in Aperio.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map(({ key, label }) => (
          <div key={key} className="rounded-[14px] border bg-[var(--surface)] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">{Number(data.totals?.[key] ?? 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[16px] border bg-[var(--surface)] p-5">
          <p className="text-sm font-semibold">Last 14 days</p>
          <div className="mt-4 h-[220px]" role="img" aria-label="Signups, analyses, and total events per day over the last 14 days">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily} margin={{ left: -18, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                <Area type="monotone" dataKey="events" stroke="var(--muted)" fill="none" strokeWidth={1} />
                <Area type="monotone" dataKey="analyses" stroke="var(--positive)" fill="none" strokeWidth={1.5} />
                <Area type="monotone" dataKey="signups" stroke="var(--primary)" fill="url(#sg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-[var(--muted)]">
            <span><i className="mr-1 inline-block size-2 rounded-full bg-[var(--primary)]" />Signups</span>
            <span><i className="mr-1 inline-block size-2 rounded-full bg-[var(--positive)]" />Analyses</span>
            <span><i className="mr-1 inline-block size-2 rounded-full bg-[var(--muted)]" />All events</span>
          </div>
        </div>

        <div className="rounded-[16px] border bg-[var(--surface)] p-5">
          <p className="text-sm font-semibold">Top actions (7d)</p>
          <div className="mt-4 h-[220px]" role="img" aria-label={`Most frequent actions in the last 7 days${data.topActions.length ? `: ${data.topActions.slice(0, 3).map((a) => `${a.action}, ${a.count}`).join("; ")}` : ""}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topActions} layout="vertical" margin={{ left: 40, right: 10 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="action" width={110} tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[16px] border bg-[var(--surface)] p-5">
          <p className="text-sm font-semibold">Newest users</p>
          <div className="mt-3 divide-y">
            {data.recentUsers.map((u) => (
              <Link key={String(u.id)} href={`/admin/users/${u.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:opacity-80">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{String(u.fullName)} {u.role === "admin" && <span className="ml-1 rounded bg-[var(--primary-soft)] px-1.5 text-[10px] font-semibold text-[var(--primary)]">admin</span>}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">{String(u.email)}</span>
                </span>
                <span className="shrink-0 text-xs text-[var(--muted)]">{formatRelative(String(u.createdAt))}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[16px] border bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Recent activity</p>
            <Link href="/admin/activity" className="text-xs font-semibold text-[var(--primary)]">View all</Link>
          </div>
          <div className="mt-3 divide-y">
            {data.recentActivity.map((e) => (
              <div key={String(e.id)} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <ActionLabel action={String(e.action)} />
                  <span className="ml-2 truncate text-xs text-[var(--muted)]">{e.actor ? String(e.actor) : "—"}</span>
                </span>
                <span className="shrink-0 text-xs text-[var(--muted)]">{formatRelative(String(e.createdAt))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
