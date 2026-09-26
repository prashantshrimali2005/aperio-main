"use client";

import { useState } from "react";
import { Bell, Check, Copy, LoaderCircle, Mail, MessageCircle, Send, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IntegrationsState } from "@/lib/integrations";

type Prefs = IntegrationsState["preferences"];
type Platform = "telegram" | "whatsapp";
type SendPref = "notifyRoadmap" | "notifyWeeklyDigest" | "notifyAnalysis" | "notifyInactivity";

const prefLabels: Record<SendPref, { title: string; hint: string }> = {
  notifyRoadmap: { title: "Roadmap reminders", hint: "A nudge with your next open roadmap step." },
  notifyWeeklyDigest: { title: "Weekly digest", hint: "Once a week: match score and what to finish next." },
  notifyAnalysis: { title: "Analysis updates", hint: "When a new analysis is ready or your résumé is scored." },
  notifyInactivity: { title: "Inactivity nudge", hint: "A reminder if a week passes with no progress." },
};

const meta: Record<Platform, { label: string; icon: typeof Send; missing: string }> = {
  telegram: { label: "Telegram", icon: Send, missing: "Telegram is not configured on the server yet." },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, missing: "WhatsApp is not configured yet. An admin can add the Meta Cloud API credentials in Admin → Integrations." },
};

export function NotificationSettings({ initial }: { initial: IntegrationsState }) {
  const [data, setData] = useState<IntegrationsState>(initial);
  const [busy, setBusy] = useState("");
  const [link, setLink] = useState<{ platform: Platform; code: string; message: string; deepLink: string | null; instructions: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const res = await fetch("/api/v1/integrations");
      const json = await res.json();
      if (res.ok) setData(json.data);
    } catch {
      /* keep current state */
    }
  }

  async function startLink(platform: Platform) {
    setBusy(`${platform}-link`);
    setError("");
    try {
      const res = await fetch(`/api/v1/integrations/${platform}/link`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not start linking.");
      setLink({
        platform,
        code: json.data.code,
        message: json.data.message ?? `Link my Aperio account: ${json.data.code}`,
        deepLink: json.data.deepLink,
        instructions: json.data.instructions,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start linking.");
    } finally {
      setBusy("");
    }
  }

  async function unlink(platform: Platform) {
    setBusy(`${platform}-unlink`);
    try {
      await fetch(`/api/v1/integrations/${platform}`, { method: "DELETE" });
      if (link?.platform === platform) setLink(null);
      await refresh();
    } finally {
      setBusy("");
    }
  }

  async function togglePref(key: keyof Prefs, value: boolean) {
    setData({ ...data, preferences: { ...data.preferences, [key]: value } });
    await fetch("/api/v1/notifications/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => refresh());
  }

  const emailOn = data.providers.email.configured && data.preferences.notifyEmail;
  const anyLinked = emailOn || data.channels.some((c) => c.status === "linked" && c.hasAddress);

  function renderChannel(platform: Platform) {
    const { label, icon: Icon, missing } = meta[platform];
    const channel = data.channels.find((c) => c.platform === platform);
    const linked = channel?.status === "linked" && channel.hasAddress;
    const configured = data.providers[platform].configured;
    const active = link?.platform === platform;

    return (
      <section key={platform} className="rounded-[16px] border bg-[var(--surface)] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-[11px] bg-[var(--primary-soft)] text-[var(--primary)]"><Icon size={18} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{label}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Link {label} to get automated messages. Aperio only sends what you enable below.</p>

            {linked ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--positive-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--positive)]"><Check size={12} />Linked{channel?.handle ? ` · ${channel.handle}` : ""}</span>
                <button onClick={() => unlink(platform)} disabled={busy === `${platform}-unlink`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--critical)]">
                  {busy === `${platform}-unlink` ? <LoaderCircle size={13} className="animate-spin" /> : <Unlink size={13} />}Unlink
                </button>
              </div>
            ) : !configured ? (
              <p className="mt-3 rounded-[10px] bg-[var(--attention-soft)] px-3 py-2 text-xs text-[var(--muted-strong)]">{missing}</p>
            ) : active ? (
              <div className="mt-3 rounded-[12px] border bg-[var(--surface-elevated)] p-4">
                <p className="text-xs text-[var(--muted)]">Send this message to {label} (the code inside is verified automatically)</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-[var(--surface)] px-2.5 py-1.5 text-sm font-semibold">{link!.message}</code>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(link!.message); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--primary)]"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[var(--muted)]">{link!.instructions}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {link!.deepLink && <Button asChild size="sm"><a href={link!.deepLink} target="_blank" rel="noreferrer"><Icon size={14} />Open {label}</a></Button>}
                  <Button size="sm" variant="secondary" onClick={refresh}>Sent it &mdash; refresh</Button>
                </div>
              </div>
            ) : (
              <Button className="mt-3" size="sm" onClick={() => startLink(platform)} disabled={busy === `${platform}-link`}>
                {busy === `${platform}-link` ? <LoaderCircle size={14} className="animate-spin" /> : <Icon size={14} />}Link {label}
              </Button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[16px] border bg-[var(--surface)] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-[11px] bg-[var(--primary-soft)] text-[var(--primary)]"><Mail size={18} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Email</h2>
            {data.providers.email.configured ? (
              <>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Sent to <b className="text-[var(--foreground)]">{data.email}</b> — welcome message, analysis / résumé-scored updates, and the weekly digest.</p>
                <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-xs font-medium">
                  <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={data.preferences.notifyEmail} onChange={(e) => togglePref("notifyEmail", e.target.checked)} />
                  Email me these updates
                </label>
              </>
            ) : (
              <p className="mt-1 rounded-[10px] bg-[var(--attention-soft)] px-3 py-2 text-xs text-[var(--muted-strong)]">Email is not configured yet. An admin can add SMTP or Resend credentials in Admin → Integrations.</p>
            )}
          </div>
        </div>
      </section>

      {renderChannel("telegram")}
      {renderChannel("whatsapp")}

      <section className="rounded-[16px] border bg-[var(--surface)] p-5">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-[var(--primary)]" />
          <h2 className="text-sm font-semibold">What to send</h2>
        </div>
        <div className="mt-3 divide-y">
          {(Object.keys(prefLabels) as SendPref[]).map((key) => (
            <label key={key} className="flex cursor-pointer items-center justify-between gap-4 py-3">
              <span>
                <span className="block text-sm font-medium">{prefLabels[key].title}</span>
                <span className="block text-xs text-[var(--muted)]">{prefLabels[key].hint}</span>
              </span>
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={Boolean(data.preferences[key])}
                onChange={(e) => togglePref(key, e.target.checked)}
              />
            </label>
          ))}
        </div>
        {!anyLinked && <p className="mt-3 text-xs text-[var(--muted)]">Link a channel above to start receiving these.</p>}
      </section>

      {error && <p role="alert" className="text-sm text-[var(--critical)]">{error}</p>}
    </div>
  );
}
