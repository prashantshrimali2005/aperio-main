import "server-only";

import { one, query } from "@/lib/db";
import { decryptSecret, encryptSecret, isEncryptionConfigured, maskSecret } from "@/lib/crypto";

export type IntegrationKey =
  | "assistant"
  | "email.smtp"
  | "telegram.bot"
  | "telegram.userbot"
  | "whatsapp.cloud"
  | "jobs.arbeitnow";

interface FieldDef {
  name: string;
  label: string;
  secret: boolean;
  placeholder?: string;
  help?: string;
  optional?: boolean;
}

export interface IntegrationSchema {
  key: IntegrationKey;
  title: string;
  description: string;
  /** custom UI panel instead of the generic field form */
  ui?: "telegram-userbot";
  docsUrl?: string;
  webhookPath?: string;
  fields: FieldDef[];
}

export const INTEGRATION_SCHEMAS: IntegrationSchema[] = [
  {
    key: "assistant",
    title: "AI assistant (auto-reply)",
    description: "When a user messages your WhatsApp or Telegram, Aperio replies automatically using Gemini with your product context and that user's own analysis, roadmap, course and job matches. Uses the same GEMINI_API_KEY.",
    fields: [
      { name: "enabled", label: "Auto-reply on? (true/false)", secret: false, optional: true, placeholder: "true" },
      { name: "linkedOnly", label: "Only reply to signed-up users? (true/false)", secret: false, optional: true, placeholder: "true", help: "false = also reply to unknown numbers." },
    ],
  },
  {
    key: "email.smtp",
    title: "Email — SMTP",
    description: "Send the welcome email and notification emails through any SMTP server. For Gmail: host smtp.gmail.com, port 587, username = your Gmail, password = a Google App Password. Tick Enabled and Save, then Test connection sends a real email to your admin address.",
    docsUrl: "https://support.google.com/accounts/answer/185833",
    fields: [
      { name: "host", label: "SMTP host", secret: false, placeholder: "smtp.gmail.com" },
      { name: "port", label: "Port", secret: false, placeholder: "587", help: "587 (STARTTLS, recommended) or 465 (SSL). TLS is handled automatically." },
      { name: "user", label: "Username", secret: false, placeholder: "you@gmail.com" },
      { name: "pass", label: "Password / app password", secret: true, help: "Gmail: Google Account → Security → App passwords (needs 2-Step Verification)." },
      { name: "fromName", label: "From name", secret: false, optional: true, placeholder: "Aperio" },
      { name: "fromEmail", label: "From email", secret: false, optional: true, help: "Leave blank to use the username. Gmail only sends as your own address (or a verified 'Send mail as' alias) — a custom domain here will be rewritten or rejected." },
    ],
  },
  {
    key: "telegram.bot",
    title: "Telegram bot",
    description: "Automated messages to users who link Telegram. Create a bot with @BotFather, then register the webhook to the path below.",
    docsUrl: "https://core.telegram.org/bots/tutorial",
    webhookPath: "/api/v1/integrations/telegram/webhook",
    fields: [
      { name: "token", label: "Bot token", secret: true, placeholder: "1234567890:AA...", help: "From @BotFather" },
      { name: "botUsername", label: "Bot @username", secret: false, placeholder: "AperioBot", help: "Without the @" },
      { name: "webhookSecret", label: "Webhook secret token", secret: true, help: "Any random string. Pass it as secret_token when calling setWebhook." },
    ],
  },
  {
    key: "telegram.userbot",
    title: "Telegram user bot",
    description: "Log in a Telegram user account by phone + OTP. Aperio completes the login and stores the resulting string session (encrypted) for later use.",
    docsUrl: "https://my.telegram.org/apps",
    ui: "telegram-userbot",
    fields: [
      { name: "apiId", label: "API ID", secret: false, placeholder: "1234567", help: "my.telegram.org → API development tools" },
      { name: "apiHash", label: "API hash", secret: true },
      { name: "phone", label: "Phone number", secret: false, placeholder: "+91XXXXXXXXXX" },
      { name: "stringSession", label: "String session", secret: true, optional: true, help: "Filled automatically after a successful OTP login." },
    ],
  },
  {
    key: "whatsapp.cloud",
    title: "WhatsApp — Meta Cloud API",
    description: "Meta's official WhatsApp Business Cloud API. Add the credentials here, then set the webhook in the Meta dashboard to the path below with the verify token you enter.",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    webhookPath: "/api/v1/integrations/whatsapp/webhook",
    fields: [
      { name: "phoneNumberId", label: "Phone number ID", secret: false, help: "WhatsApp → API Setup" },
      { name: "businessNumber", label: "Business phone (digits)", secret: false, optional: true, placeholder: "15551234567", help: "Country code + number, digits only. Builds the wa.me link users message." },
      { name: "wabaId", label: "WhatsApp Business Account ID", secret: false, optional: true },
      { name: "accessToken", label: "Access token", secret: true, help: "System-user token, long-lived." },
      { name: "verifyToken", label: "Webhook verify token", secret: true, help: "Any random string. Paste the SAME value into the Meta webhook config." },
      { name: "appSecret", label: "Meta app secret", secret: true, optional: true, help: "App → Settings → Basic. Enables X-Hub-Signature-256 verification." },
    ],
  },
  {
    key: "jobs.arbeitnow",
    title: "Job postings — Arbeitnow (free)",
    description: "Free public job-board API, no key required. When enabled, npm run market:ingest counts skill mentions across recent postings into weighted market signals.",
    docsUrl: "https://www.arbeitnow.com/api",
    fields: [
      { name: "pages", label: "Pages to scan per run", secret: false, optional: true, placeholder: "5", help: "~100 postings per page. Default 5." },
      { name: "remoteOnly", label: "Remote only? (true/false)", secret: false, optional: true, placeholder: "false" },
    ],
  },
];

export function schemaFor(key: string): IntegrationSchema | undefined {
  return INTEGRATION_SCHEMAS.find((s) => s.key === key);
}

interface SettingsRow extends Record<string, unknown> {
  key: string;
  config: Record<string, string>;
  secrets: Record<string, string>;
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

async function readRow(key: IntegrationKey) {
  return one<SettingsRow>(
    `SELECT key, config, secrets, enabled, updated_by AS "updatedBy", updated_at AS "updatedAt"
     FROM integration_settings WHERE key=$1`,
    [key],
  );
}

/** Admin-facing view: config in the clear, secrets only as presence + mask. */
export async function getIntegrationForAdmin(key: IntegrationKey) {
  const schema = schemaFor(key)!;
  const row = await readRow(key);
  const secretFields: Record<string, { set: boolean; masked: string | null }> = {};
  for (const field of schema.fields.filter((f) => f.secret)) {
    const stored = row?.secrets?.[field.name];
    let masked: string | null = null;
    if (stored && isEncryptionConfigured()) {
      try {
        masked = maskSecret(decryptSecret(stored));
      } catch {
        masked = "•••• (unreadable — key changed?)";
      }
    }
    secretFields[field.name] = { set: Boolean(stored), masked };
  }
  return {
    key,
    schema,
    enabled: row?.enabled ?? false,
    config: row?.config ?? {},
    secrets: secretFields,
    updatedBy: row?.updatedBy ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

export async function saveIntegration(
  key: IntegrationKey,
  input: { config?: Record<string, string>; secrets?: Record<string, string>; enabled?: boolean },
  updatedBy: string,
) {
  const schema = schemaFor(key);
  if (!schema) throw new Error("UNKNOWN_INTEGRATION");
  const existing = await readRow(key);

  const config = { ...(existing?.config ?? {}) };
  for (const field of schema.fields.filter((f) => !f.secret)) {
    if (input.config && field.name in input.config) config[field.name] = String(input.config[field.name] ?? "").slice(0, 500);
  }

  const secrets = { ...(existing?.secrets ?? {}) };
  for (const field of schema.fields.filter((f) => f.secret)) {
    if (!input.secrets || !(field.name in input.secrets)) continue;
    const value = String(input.secrets[field.name] ?? "");
    if (value === "") delete secrets[field.name];
    else secrets[field.name] = encryptSecret(value.slice(0, 4000));
  }

  const enabled = typeof input.enabled === "boolean" ? input.enabled : existing?.enabled ?? false;

  await query(
    `INSERT INTO integration_settings (key, config, secrets, enabled, updated_by, updated_at)
     VALUES ($1,$2::jsonb,$3::jsonb,$4,$5, now())
     ON CONFLICT (key) DO UPDATE SET config=EXCLUDED.config, secrets=EXCLUDED.secrets,
       enabled=EXCLUDED.enabled, updated_by=EXCLUDED.updated_by, updated_at=now()`,
    [key, JSON.stringify(config), JSON.stringify(secrets), enabled, updatedBy],
  );
  return getIntegrationForAdmin(key);
}

/** Merge arbitrary encrypted secret keys (used by multi-step flows like userbot login). */
export async function setRawSecrets(key: IntegrationKey, patch: Record<string, string | null>) {
  const row = await readRow(key);
  const secrets = { ...(row?.secrets ?? {}) };
  for (const [field, value] of Object.entries(patch)) {
    if (value === null) delete secrets[field];
    else secrets[field] = encryptSecret(value);
  }
  await query(
    `INSERT INTO integration_settings (key, secrets, updated_at) VALUES ($1,$2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET secrets=EXCLUDED.secrets, updated_at=now()`,
    [key, JSON.stringify(secrets)],
  );
}

/** Runtime accessor — returns decrypted values. Server-only, never send to a client. */
export async function getIntegrationRuntime(key: IntegrationKey) {
  const row = await readRow(key);
  if (!row) return { enabled: false, config: {} as Record<string, string>, secret: () => null as string | null };
  return {
    enabled: row.enabled,
    config: row.config ?? {},
    secret(field: string): string | null {
      const stored = row.secrets?.[field];
      if (!stored || !isEncryptionConfigured()) return null;
      try {
        return decryptSecret(stored);
      } catch {
        return null;
      }
    },
  };
}
