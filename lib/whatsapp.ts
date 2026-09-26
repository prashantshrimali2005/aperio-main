import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getIntegrationRuntime } from "@/lib/settings";

const GRAPH = "https://graph.facebook.com/v21.0";

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  appSecret: string;
  businessNumber: string;
  configured: boolean;
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  try {
    const rt = await getIntegrationRuntime("whatsapp.cloud");
    const phoneNumberId = String(rt.config.phoneNumberId ?? "").trim();
    const accessToken = rt.secret("accessToken") ?? "";
    return {
      phoneNumberId,
      accessToken,
      verifyToken: rt.secret("verifyToken") ?? "",
      appSecret: rt.secret("appSecret") ?? "",
      businessNumber: String(rt.config.businessNumber ?? "").replace(/[^\d]/g, ""),
      configured: Boolean(phoneNumberId && accessToken),
    };
  } catch {
    return { phoneNumberId: "", accessToken: "", verifyToken: "", appSecret: "", businessNumber: "", configured: false };
  }
}

interface WaError {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_data?: { details?: string };
}

function waFailure(prefix: string, err: WaError | undefined, httpStatus: number) {
  const raw = err?.message || `HTTP ${httpStatus}`;
  const details = err?.error_data?.details;
  if (err?.code === 190 || /authenticat|access token|expired|OAuth/i.test(raw)) {
    return `${prefix}: WhatsApp rejected the access token. Meta's temporary tokens last 24h — create a permanent System User token in Meta Business Settings and paste it under Admin → Integrations → WhatsApp.`;
  }
  if (err?.code === 131047 || /24 hour|re-engagement|outside the allowed window/i.test(raw + (details ?? ""))) {
    return `${prefix}: outside WhatsApp's 24-hour window. You can only send free-form text within 24h of the contact's last message; otherwise an approved template is required.`;
  }
  return `${prefix}: ${raw}${details ? ` (${details})` : ""}`;
}

/** X-Hub-Signature-256 check. Skipped (returns true) when no app secret is stored. */
export function verifyWhatsAppSignature(appSecret: string, rawBody: string, header: string | null) {
  if (!appSecret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(header.slice(7), "hex"));
  } catch {
    return false;
  }
}

/** Telegram-style <b> tags -> WhatsApp *bold*. */
export function toWhatsAppText(text: string) {
  return text.replace(/<\/?b>/g, "*").replace(/<[^>]+>/g, "");
}

export async function sendWhatsAppText(to: string, body: string) {
  const cfg = await getWhatsAppConfig();
  if (!cfg.configured) throw new Error("WHATSAPP_NOT_CONFIGURED");
  const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/[^\d]/g, ""),
      type: "text",
      text: { preview_url: false, body: toWhatsAppText(body).slice(0, 4000) },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: WaError; messages?: Array<{ id?: string }> };
  if (!res.ok) throw new Error(waFailure("WHATSAPP_SEND_FAILED", json?.error, res.status));
  return { externalId: json.messages?.[0]?.id ?? null };
}

const WA_TYPE_FOR_MIME = (mime: string): "image" | "audio" | "video" | "document" => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
};

/** Download an inbound media object by its WhatsApp media id. */
export async function downloadWhatsAppMedia(mediaId: string) {
  const cfg = await getWhatsAppConfig();
  if (!cfg.configured) throw new Error("WHATSAPP_NOT_CONFIGURED");
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { authorization: `Bearer ${cfg.accessToken}` } });
  if (!metaRes.ok) throw new Error(`WHATSAPP_MEDIA_META_FAILED: ${metaRes.status}`);
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!meta.url) throw new Error("WHATSAPP_MEDIA_NO_URL");
  const binRes = await fetch(meta.url, { headers: { authorization: `Bearer ${cfg.accessToken}` } });
  if (!binRes.ok) throw new Error(`WHATSAPP_MEDIA_DOWNLOAD_FAILED: ${binRes.status}`);
  return { data: Buffer.from(await binRes.arrayBuffer()), mime: meta.mime_type || "application/octet-stream" };
}

/** Upload a file for sending; returns a media id. */
export async function uploadWhatsAppMedia(data: Buffer, mime: string, filename: string) {
  const cfg = await getWhatsAppConfig();
  if (!cfg.configured) throw new Error("WHATSAPP_NOT_CONFIGURED");
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", mime);
  form.set("file", new Blob([new Uint8Array(data)], { type: mime }), filename || "upload");
  const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/media`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.accessToken}` },
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: WaError };
  if (!res.ok || !json.id) throw new Error(waFailure("WHATSAPP_UPLOAD_FAILED", json?.error, res.status));
  return json.id;
}

export async function sendWhatsAppMedia(to: string, mediaId: string, mime: string, opts: { caption?: string; filename?: string } = {}) {
  const cfg = await getWhatsAppConfig();
  if (!cfg.configured) throw new Error("WHATSAPP_NOT_CONFIGURED");
  const type = WA_TYPE_FOR_MIME(mime);
  const payload: Record<string, unknown> = { messaging_product: "whatsapp", to: to.replace(/[^\d]/g, ""), type };
  payload[type] =
    type === "document"
      ? { id: mediaId, caption: opts.caption || undefined, filename: opts.filename || undefined }
      : { id: mediaId, caption: type === "audio" ? undefined : opts.caption || undefined };
  const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: WaError; messages?: Array<{ id?: string }> };
  if (!res.ok) throw new Error(waFailure("WHATSAPP_SEND_FAILED", json?.error, res.status));
  return { externalId: json.messages?.[0]?.id ?? null };
}

/** A "poll" on WhatsApp: reply buttons (<=3 options) or a list (<=10). */
export async function sendWhatsAppPoll(to: string, question: string, options: string[]) {
  const cfg = await getWhatsAppConfig();
  if (!cfg.configured) throw new Error("WHATSAPP_NOT_CONFIGURED");
  const opts = options.slice(0, 10);
  const interactive: Record<string, unknown> =
    opts.length <= 3
      ? {
          type: "button",
          body: { text: question.slice(0, 1024) },
          action: { buttons: opts.map((o, i) => ({ type: "reply", reply: { id: `opt_${i}`, title: o.slice(0, 20) } })) },
        }
      : {
          type: "list",
          body: { text: question.slice(0, 1024) },
          action: {
            button: "Choose",
            sections: [{ title: "Options", rows: opts.map((o, i) => ({ id: `opt_${i}`, title: o.slice(0, 24) })) }],
          },
        };
  const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/[^\d]/g, ""), type: "interactive", interactive }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: WaError; messages?: Array<{ id?: string }> };
  if (!res.ok) throw new Error(waFailure("WHATSAPP_POLL_FAILED", json?.error, res.status));
  return json.messages?.[0]?.id ?? null;
}

/**
 * A tappable single-choice list (used by the conversational practice quiz).
 * Each row carries a stable `id` we read back from `interactive.list_reply.id`.
 */
export async function sendWhatsAppChoiceList(
  to: string,
  header: string,
  bodyText: string,
  rows: Array<{ id: string; title: string; description?: string }>,
  buttonLabel = "Choose",
) {
  const cfg = await getWhatsAppConfig();
  if (!cfg.configured) throw new Error("WHATSAPP_NOT_CONFIGURED");
  const interactive = {
    type: "list",
    header: header ? { type: "text", text: header.slice(0, 60) } : undefined,
    body: { text: bodyText.slice(0, 1024) },
    action: {
      button: buttonLabel.slice(0, 20),
      sections: [
        {
          rows: rows.slice(0, 10).map((r) => ({
            id: r.id.slice(0, 200),
            title: r.title.slice(0, 24),
            ...(r.description ? { description: r.description.slice(0, 72) } : {}),
          })),
        },
      ],
    },
  };
  const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/[^\d]/g, ""), type: "interactive", interactive }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: WaError; messages?: Array<{ id?: string }> };
  if (!res.ok) throw new Error(waFailure("WHATSAPP_LIST_FAILED", json?.error, res.status));
  return json.messages?.[0]?.id ?? null;
}
