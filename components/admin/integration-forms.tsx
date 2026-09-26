"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, LoaderCircle, Plug, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FieldDef {
  name: string;
  label: string;
  secret: boolean;
  placeholder?: string;
  help?: string;
  optional?: boolean;
}
interface Integration {
  key: string;
  schema: { key: string; title: string; description: string; ui?: string; docsUrl?: string; webhookPath?: string; fields: FieldDef[] };
  enabled: boolean;
  config: Record<string, string>;
  secrets: Record<string, { set: boolean; masked: string | null }>;
  updatedBy: string | null;
  updatedAt: string | null;
}

function CopyRow({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-2 rounded-[9px] border bg-[var(--surface-elevated)] px-3 py-2">
      <code className="min-w-0 flex-1 truncate text-xs">{value}</code>
      <button
        onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1200); }}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"
      >
        {done ? <Check size={12} /> : <Copy size={12} />}{done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function GenericPanel({ integration, origin }: { integration: Integration; origin: string }) {
  const [enabled, setEnabled] = useState(integration.enabled);
  const [config, setConfig] = useState<Record<string, string>>({ ...integration.config });
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [state, setState] = useState(integration);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/admin/integrations/${integration.key}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config, secrets, enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Save failed.");
      setState(json.data);
      setSecrets({});
      setMessage({ ok: true, text: "Saved." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/admin/integrations/${integration.key}/test`, { method: "POST" });
      const json = await res.json();
      const result = json.data ?? {};
      setMessage({ ok: Boolean(result.ok), text: result.detail || (result.ok ? "OK" : "Failed") });
    } catch {
      setMessage({ ok: false, text: "Test request failed." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{integration.schema.title}</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-[var(--muted)]">{integration.schema.description}</p>
          {integration.schema.docsUrl && (
            <a href={integration.schema.docsUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
              Docs <ExternalLink size={11} />
            </a>
          )}
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>

      {integration.schema.webhookPath && (
        <div className="mt-4">
          <p className="text-xs font-medium">Webhook / callback URL</p>
          <CopyRow value={`${origin}${integration.schema.webhookPath}`} />
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {integration.schema.fields.map((field) => {
          const stored = state.secrets[field.name];
          return (
            <label key={field.name} className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                {field.secret && <KeyRound size={11} className="text-[var(--muted)]" />}
                {field.label}
                {field.optional && <span className="text-[var(--muted)]">(optional)</span>}
                {field.secret && stored?.set && <span className="ml-auto rounded bg-[var(--positive-soft)] px-1.5 text-[10px] font-semibold text-[var(--positive)]">stored {stored.masked}</span>}
              </span>
              {field.secret ? (
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={stored?.set ? "•••••••• (blank keeps current)" : field.placeholder || "Enter value"}
                  value={secrets[field.name] ?? ""}
                  onChange={(e) => setSecrets((s) => ({ ...s, [field.name]: e.target.value }))}
                />
              ) : (
                <Input placeholder={field.placeholder} value={config[field.name] ?? ""} onChange={(e) => setConfig((c) => ({ ...c, [field.name]: e.target.value }))} />
              )}
              {field.help && <span className="mt-1 block text-[10px] text-[var(--muted)]">{field.help}</span>}
            </label>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Save</Button>
        <Button size="sm" variant="secondary" onClick={test} disabled={testing}>{testing ? <LoaderCircle size={14} className="animate-spin" /> : <Plug size={14} />}Test connection</Button>
        {state.updatedAt && <span className="text-[11px] text-[var(--muted)]">Updated by {state.updatedBy ?? "—"}</span>}
        {message && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${message.ok ? "text-[var(--positive)]" : "text-[var(--critical)]"}`}>
            {message.ok ? <Check size={13} /> : <X size={13} />}{message.text}
          </span>
        )}
      </div>
    </div>
  );
}

function UserbotPanel({ integration }: { integration: Integration }) {
  const [config, setConfig] = useState<Record<string, string>>({ ...integration.config });
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [state, setState] = useState(integration);
  const [status, setStatus] = useState<{ hasCreds: boolean; loggedIn: boolean; pending: boolean; phone: string; sessionError?: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/admin/integrations/telegram/userbot")
      .then((r) => r.json())
      .then((j) => !cancelled && j?.data && setStatus(j.data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshStatus() {
    const j = await fetch("/api/v1/admin/integrations/telegram/userbot").then((r) => r.json()).catch(() => null);
    if (j?.data) setStatus(j.data);
  }

  async function saveCreds() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/admin/integrations/${integration.key}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config, secrets }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Save failed.");
      setState(json.data);
      setSecrets({});
      setMessage({ ok: true, text: "Credentials saved." });
      await refreshStatus();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  async function sendCode() {
    setBusy("send");
    setMessage(null);
    setNeedPassword(false);
    try {
      const res = await fetch("/api/v1/admin/integrations/telegram/userbot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "send-code" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not send the code.");
      setMessage({ ok: true, text: json.data.viaApp ? "Code sent inside Telegram." : "Code sent by SMS." });
      await refreshStatus();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not send the code." });
    } finally {
      setBusy("");
    }
  }

  async function signIn() {
    setBusy("signin");
    setMessage(null);
    try {
      const res = await fetch("/api/v1/admin/integrations/telegram/userbot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sign-in", code, password: password || undefined }),
      });
      const json = await res.json();
      if (res.status === 401 && json.error?.code === "PASSWORD_REQUIRED") {
        setNeedPassword(true);
        setMessage({ ok: false, text: "Two-step verification is on — enter the password." });
        return;
      }
      if (!res.ok) throw new Error(json.error?.message || "Sign-in failed.");
      setMessage({ ok: true, text: json.data.me?.username ? `Logged in as @${json.data.me.username}` : "Logged in. Session saved." });
      setCode("");
      setPassword("");
      setNeedPassword(false);
      await refreshStatus();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Sign-in failed." });
    } finally {
      setBusy("");
    }
  }

  const storedSession = state.secrets.stringSession;

  return (
    <div>
      <div>
        <h2 className="text-base font-semibold">{integration.schema.title}</h2>
        <p className="mt-1 max-w-xl text-xs leading-5 text-[var(--muted)]">{integration.schema.description}</p>
        <a href={integration.schema.docsUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">Get API ID / hash <ExternalLink size={11} /></a>
      </div>

      {status && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-[9px] border px-3 py-1.5 text-xs font-medium">
          <span className={cn("size-2 rounded-full", status.loggedIn ? "bg-[var(--positive)]" : status.pending ? "bg-[var(--attention)]" : "bg-[var(--muted)]")} />
          {status.loggedIn ? "Logged in — session stored" : status.pending ? "OTP sent, awaiting code" : status.hasCreds ? "Credentials saved, not logged in" : "No credentials yet"}
        </div>
      )}

      {status?.sessionError && (
        <p className="mt-2 rounded-[9px] border border-[var(--critical)]/40 bg-[var(--critical)]/5 px-3 py-2 text-xs text-[var(--critical)]">
          Telegram invalidated the stored session ({status.sessionError}). Send a new OTP and sign in again — one login is enough; concurrent connections are now serialised so it won&apos;t drop on its own.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">API ID</span>
          <Input value={config.apiId ?? ""} onChange={(e) => setConfig((c) => ({ ...c, apiId: e.target.value }))} placeholder="1234567" />
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium"><KeyRound size={11} className="text-[var(--muted)]" />API hash{state.secrets.apiHash?.set && <span className="ml-auto rounded bg-[var(--positive-soft)] px-1.5 text-[10px] font-semibold text-[var(--positive)]">stored</span>}</span>
          <Input type="password" autoComplete="new-password" value={secrets.apiHash ?? ""} onChange={(e) => setSecrets((s) => ({ ...s, apiHash: e.target.value }))} placeholder={state.secrets.apiHash?.set ? "•••••••• (blank keeps current)" : "API hash"} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium">Phone number</span>
          <Input value={config.phone ?? ""} onChange={(e) => setConfig((c) => ({ ...c, phone: e.target.value }))} placeholder="+91XXXXXXXXXX" />
        </label>
      </div>
      <Button size="sm" className="mt-3" onClick={saveCreds} disabled={saving}>{saving ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Save credentials</Button>

      <div className="mt-6 rounded-[12px] border bg-[var(--surface-elevated)] p-4">
        <p className="text-sm font-semibold">Log in with OTP</p>
        <p className="mt-1 text-xs text-[var(--muted)]">Telegram sends a code to {status?.phone || "the phone above"}. Aperio completes the login and stores the string session (encrypted) for reuse.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Button size="sm" variant="secondary" onClick={sendCode} disabled={Boolean(busy) || !status?.hasCreds}>
            {busy === "send" ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />}Send OTP
          </Button>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-[var(--muted)]">OTP code</span>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="12345" className="w-28" inputMode="numeric" />
          </label>
          {needPassword && (
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-[var(--muted)]">2-step password</span>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-40" />
            </label>
          )}
          <Button size="sm" onClick={signIn} disabled={Boolean(busy) || code.length < 4}>
            {busy === "signin" ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Sign in
          </Button>
        </div>
        {storedSession?.set && <p className="mt-3 text-[11px] text-[var(--muted)]">String session stored ({storedSession.masked}). Delete it by clearing the field is not exposed here — re-login to replace it.</p>}
      </div>

      {message && (
        <p className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${message.ok ? "text-[var(--positive)]" : "text-[var(--critical)]"}`}>
          {message.ok ? <Check size={13} /> : <X size={13} />}{message.text}
        </p>
      )}
    </div>
  );
}

export function IntegrationForms({ integrations, encryptionReady }: { integrations: Integration[]; encryptionReady: boolean }) {
  const [selected, setSelected] = useState(integrations[0]?.key ?? "");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const current = integrations.find((i) => i.key === selected) ?? integrations[0];

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Credentials are encrypted with APP_ENCRYPTION_KEY and stored in the database — not in environment files.</p>
      </div>

      {!encryptionReady && (
        <div className="mb-4 rounded-[12px] border border-[color-mix(in_srgb,var(--critical)_35%,var(--border))] bg-[var(--critical-soft)] p-4 text-sm text-[var(--critical)]">
          <b>APP_ENCRYPTION_KEY is not set.</b> Add it to the server environment before saving any credentials.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="flex gap-1 overflow-x-auto rounded-[14px] border bg-[var(--surface)] p-2 lg:flex-col lg:overflow-visible">
          {integrations.map((i) => {
            const configured = Object.values(i.secrets).some((s) => s.set) || Object.values(i.config).some(Boolean);
            return (
              <button
                key={i.key}
                onClick={() => setSelected(i.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-[9px] px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  current?.key === i.key ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]" : "text-[var(--muted-strong)] hover:bg-[var(--surface-muted)]",
                )}
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", i.enabled ? "bg-[var(--positive)]" : configured ? "bg-[var(--attention)]" : "bg-[var(--muted)]")} />
                <span className="truncate">{i.schema.title}</span>
              </button>
            );
          })}
        </nav>

        <section className="rounded-[16px] border bg-[var(--surface)] p-5">
          {current && (current.schema.ui === "telegram-userbot"
            ? <UserbotPanel key={current.key} integration={current} />
            : <GenericPanel key={current.key} integration={current} origin={origin} />)}
        </section>
      </div>
    </div>
  );
}
