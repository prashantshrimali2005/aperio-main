import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatRelative } from "@/lib/utils";
import { ActionLabel } from "@/components/admin/action-label";

type D = {
  user: Record<string, unknown>;
  resumes: Array<Record<string, unknown>>;
  analyses: Array<Record<string, unknown>>;
  roadmaps: Array<Record<string, unknown>>;
  learningPaths: Array<Record<string, unknown>>;
  channels: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  activity: Array<Record<string, unknown>>;
  preferences: Record<string, unknown> | null;
};

function Panel({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}{count !== undefined && <span className="ml-1.5 text-[var(--foreground)]">{count}</span>}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function UserDossier({ data }: { data: D }) {
  const u = data.user;
  return (
    <div className="space-y-5">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"><ArrowLeft size={13} />Users</Link>

      <div className="rounded-[16px] border bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              {String(u.fullName)}
              {u.role === "admin" && <span className="rounded bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary)]">admin</span>}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{String(u.email)} · {String(u.authProvider ?? "password")}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Joined {formatDate(String(u.createdAt))} · Last seen {u.lastSeenAt ? formatRelative(String(u.lastSeenAt)) : "—"}
            </p>
          </div>
          <div className="text-right text-xs text-[var(--muted)]">
            {u.targetRoleTitle ? <p>Target: <b className="text-[var(--foreground)]">{String(u.targetRoleTitle)}</b> · {String(u.targetLevel ?? "")}</p> : <p>No target role</p>}
            <p className="mt-1">Onboarded: {u.onboardingCompleted ? "yes" : "no"}</p>
          </div>
        </div>
        {Boolean(u.headline || u.bio) && (
          <div className="mt-3 border-t pt-3 text-sm text-[var(--muted-strong)]">
            {u.headline ? <p className="font-medium">{String(u.headline)}</p> : null}
            {u.bio ? <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{String(u.bio)}</p> : null}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Résumés" count={data.resumes.length}>
          {data.resumes.length ? (
            <div className="space-y-3">
              {data.resumes.map((r) => (
                <details key={String(r.id)} className="rounded-[10px] border bg-[var(--surface-elevated)] p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    {String(r.filename)} <span className="text-xs font-normal text-[var(--muted)]">· {String(r.documentType ?? "—")} · {Math.round(Number(r.validationConfidence ?? 0) * 100)}% · {Number(r.skillCount)} skills · {formatDate(String(r.createdAt))}</span>
                  </summary>
                  <p className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded bg-[var(--surface)] p-2 text-[11px] leading-5 text-[var(--muted)]">{String(r.extractedTextPreview ?? "")}</p>
                  <p className="mt-1 text-[10px] text-[var(--muted)]">Raw file is not retained — extracted text and parsed data only.</p>
                </details>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--muted)]">None.</p>}
        </Panel>

        <Panel title="Analyses" count={data.analyses.length}>
          {data.analyses.length ? (
            <div className="divide-y">
              {data.analyses.map((a) => (
                <Link key={String(a.id)} href={`/history/${a.id}`} className="flex items-center justify-between py-2 text-sm hover:opacity-80">
                  <span className="min-w-0 truncate">{String(a.roleTitle)} <span className="text-xs text-[var(--muted)]">· {String(a.experienceLevel)}</span></span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">{Number(a.overallScore)}% (T{Number(a.technicalScore ?? 0)}/S{Number(a.softScore ?? 0)}) · {formatRelative(String(a.createdAt))}</span>
                </Link>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--muted)]">None.</p>}
        </Panel>

        <Panel title="Course plans" count={data.learningPaths.length}>
          {data.learningPaths.length ? (
            <div className="divide-y">
              {data.learningPaths.map((p) => (
                <div key={String(p.id)} className="flex items-center justify-between py-2 text-sm">
                  <span className="min-w-0 truncate">{String(p.title)} <span className="text-xs text-[var(--muted)]">· {String(p.generator)} · {String(p.status)}</span></span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">{Number(p.completed)}/{Number(p.modules)} · {Number(p.totalWeeks)}w</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--muted)]">None.</p>}
        </Panel>

        <Panel title="Roadmaps" count={data.roadmaps.length}>
          {data.roadmaps.length ? (
            <div className="divide-y">
              {data.roadmaps.map((r) => (
                <div key={String(r.id)} className="flex items-center justify-between py-2 text-sm">
                  <span className="min-w-0 truncate">{String(r.title)}</span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">{Number(r.completed)}/{Number(r.items)} done</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--muted)]">None.</p>}
        </Panel>

        <Panel title="Messaging channels">
          {data.channels.length ? (
            <div className="space-y-1.5 text-sm">
              {data.channels.map((c) => (
                <div key={String(c.platform)} className="flex items-center justify-between">
                  <span className="capitalize">{String(c.platform)} <span className="text-xs text-[var(--muted)]">{c.handle ? String(c.handle) : ""}</span></span>
                  <span className={`text-xs font-medium ${c.status === "linked" ? "text-[var(--positive)]" : "text-[var(--muted)]"}`}>{String(c.status)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--muted)]">No channels linked.</p>}
          {data.preferences && (
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              Notify: {["notifyRoadmap", "notifyWeeklyDigest", "notifyAnalysis", "notifyInactivity"].filter((k) => data.preferences?.[k]).map((k) => k.replace("notify", "")).join(", ") || "all off"}
            </p>
          )}
        </Panel>

        <Panel title="Recent notifications" count={data.notifications.length}>
          {data.notifications.length ? (
            <div className="divide-y">
              {data.notifications.map((n, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-xs">
                  <span>{String(n.kind)} <span className={n.status === "sent" ? "text-[var(--positive)]" : "text-[var(--muted)]"}>· {String(n.status)}</span></span>
                  <span className="text-[var(--muted)]">{formatRelative(String(n.createdAt))}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--muted)]">None.</p>}
        </Panel>
      </div>

      <Panel title="Activity timeline" count={data.activity.length}>
        <div className="divide-y">
          {data.activity.map((e) => (
            <div key={String(e.id)} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <ActionLabel action={String(e.action)} />
                {e.metadata != null && Object.keys(e.metadata as object).length > 0 ? (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--muted)]">{JSON.stringify(e.metadata)}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-[var(--muted)]">{formatRelative(String(e.createdAt))}</span>
            </div>
          ))}
          {!data.activity.length && <p className="py-4 text-sm text-[var(--muted)]">No activity.</p>}
        </div>
      </Panel>
    </div>
  );
}
