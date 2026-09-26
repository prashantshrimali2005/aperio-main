import "server-only";

import { getIntegrationRuntime } from "@/lib/settings";

const API_BASE = "https://api.telegram.org";

export interface TelegramConfig {
  token: string;
  botUsername: string;
  webhookSecret: string;
  configured: boolean;
}

/**
 * Credentials come from the admin UI (encrypted in `integration_settings`) and
 * fall back to environment variables so an env-only setup keeps working.
 */
export async function getTelegramConfig(): Promise<TelegramConfig> {
  let token = "";
  let botUsername = "";
  let webhookSecret = "";
  try {
    const runtime = await getIntegrationRuntime("telegram.bot");
    token = runtime.secret("token") ?? "";
    botUsername = (runtime.config.botUsername ?? "").replace(/^@/, "");
    webhookSecret = runtime.secret("webhookSecret") ?? "";
  } catch {
    /* fall through to env */
  }
  token ||= process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  botUsername ||= (process.env.TELEGRAM_BOT_USERNAME?.trim() || "").replace(/^@/, "");
  webhookSecret ||= process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";
  return { token, botUsername, webhookSecret, configured: Boolean(token) };
}

export async function isTelegramConfigured() {
  return (await getTelegramConfig()).configured;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(chatId: string, text: string, opts: { preformatted?: boolean } = {}) {
  const { token } = await getTelegramConfig();
  if (!token) throw new Error("TELEGRAM_NOT_CONFIGURED");
  const body = opts.preformatted ? text : escapeHtml(text);
  const response = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: body,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      link_preview_options: { is_disabled: true },
    }),
  });
  const json = (await response.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!response.ok || !json.ok) {
    throw new Error(`TELEGRAM_SEND_FAILED: ${json.description || response.status}`);
  }
  return json;
}

export async function sendTelegramPoll(chatId: string, question: string, options: string[]) {
  const { token } = await getTelegramConfig();
  if (!token) throw new Error("TELEGRAM_NOT_CONFIGURED");
  const response = await fetch(`${API_BASE}/bot${token}/sendPoll`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      question: question.slice(0, 300),
      options: options.slice(0, 10).map((o) => o.slice(0, 100)),
      is_anonymous: false,
      allows_multiple_answers: false,
    }),
  });
  const json = (await response.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: { poll?: { id?: string } } };
  if (!response.ok || !json.ok) throw new Error(`TELEGRAM_POLL_FAILED: ${json.description || response.status}`);
  return json.result?.poll?.id ?? null;
}

export async function telegramGetMe() {
  const { token } = await getTelegramConfig();
  if (!token) throw new Error("TELEGRAM_NOT_CONFIGURED");
  const response = await fetch(`${API_BASE}/bot${token}/getMe`);
  const json = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: { username?: string }; description?: string };
  if (!response.ok || !json.ok) throw new Error(json.description || `HTTP ${response.status}`);
  return json.result ?? {};
}

export interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id: number | string; type?: string; username?: string; first_name?: string };
    from?: { username?: string; first_name?: string };
  };
}

// Aperio link codes: 8 chars from an unambiguous alphabet (no 0/O/1/I).
const CODE_CHARS = "A-HJ-NP-Z2-9";
const CODE_RE = new RegExp(`[${CODE_CHARS}]{8}`, "i");

/**
 * Pull a link code out of:
 *  - "/start CODE" / "/start=CODE"
 *  - a friendly sentence like "Link my Aperio account: CODE"
 *  - a bare code message
 */
export function parseLinkCode(text: string | undefined) {
  if (!text) return null;
  const trimmed = text.trim();

  const startMatch = trimmed.match(/^\/start(?:[=\s]+(.+))?$/i);
  if (startMatch) {
    const code = (startMatch[1] ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return code.length >= 6 && code.length <= 24 ? code : null;
  }

  // "...link / account / code / aperio ... <CODE>"
  const phrase = trimmed.match(new RegExp(`(?:link|account|code|aperio)[^A-Za-z0-9]*([${CODE_CHARS}]{8})\\b`, "i"));
  if (phrase) return phrase[1].toUpperCase();

  // Bare code, possibly with surrounding punctuation/quotes.
  const bare = trimmed.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (bare.length >= 6 && bare.length <= 24 && new RegExp(`^[${CODE_CHARS}]+$`, "i").test(bare)) return bare;

  // Fallback: a lone code-shaped token anywhere (e.g. wrapped in a longer line).
  if (!/\s/.test(trimmed)) {
    const m = trimmed.toUpperCase().match(CODE_RE);
    if (m) return m[0];
  }
  return null;
}

/** The message we ask a user to send so linking reads nicely in the chat. */
export function linkCodeMessage(code: string) {
  return `Link my Aperio account: ${code}`;
}
