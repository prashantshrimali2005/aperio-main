import { NextResponse, after } from "next/server";
import { query } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { maybeAutoReply } from "@/lib/assistant";
import { recordMessage, recordPollVote, updateMessageStatus, upsertThread, type MessageKind } from "@/lib/chat";
import { parseLinkCode } from "@/lib/telegram";
import { getWhatsAppConfig, sendWhatsAppText, verifyWhatsAppSignature } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

interface WaMediaObj {
  id?: string;
  mime_type?: string;
  filename?: string;
  caption?: string;
  voice?: boolean;
}
interface WaMessage {
  id?: string;
  from?: string;
  type?: string;
  timestamp?: string;
  text?: { body?: string };
  image?: WaMediaObj;
  audio?: WaMediaObj;
  video?: WaMediaObj;
  document?: WaMediaObj;
  voice?: WaMediaObj;
  sticker?: WaMediaObj;
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
}
interface WaStatus {
  id?: string;
  status?: string;
}
interface WaValue {
  messages?: WaMessage[];
  statuses?: WaStatus[];
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
}
interface WaPayload {
  entry?: Array<{ changes?: Array<{ value?: WaValue }> }>;
}

const KIND_MAP: Record<string, MessageKind> = {
  text: "text", image: "image", audio: "audio", video: "video", document: "file", voice: "voice", sticker: "sticker",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const cfg = await getWhatsAppConfig();
  if (mode === "subscribe" && cfg.verifyToken && token === cfg.verifyToken) {
    return new NextResponse(challenge ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const cfg = await getWhatsAppConfig();
  if (!verifyWhatsAppSignature(cfg.appSecret, raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: WaPayload;
  try {
    payload = JSON.parse(raw) as WaPayload;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const values: WaValue[] = (payload.entry ?? []).flatMap((entry) => (entry.changes ?? []).map((c) => c.value ?? {}));

  for (const value of values) {
    const nameByWaId = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));

    for (const status of value.statuses ?? []) {
      if (!status.id || !status.status) continue;
      const rows = await query<{ id: string }>(`SELECT id FROM chat_messages WHERE external_id=$1 LIMIT 1`, [status.id]);
      if (rows[0]) await updateMessageStatus(rows[0].id, ["sent", "delivered", "read", "failed"].includes(status.status) ? status.status : "sent");
    }

    for (const msg of value.messages ?? []) {
      try {
        await handleInbound(msg, nameByWaId, request);
      } catch (error) {
        console.error("whatsapp inbound handling failed", error instanceof Error ? error.message : error);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleInbound(msg: WaMessage, nameByWaId: Map<string | undefined, string | undefined>, request: Request) {
  const from = String(msg.from || "").replace(/\D/g, "");
  if (!from || !msg.type) return;
  const displayName = nameByWaId.get(from) ?? `+${from}`;
  const threadId = await upsertThread({ channel: "whatsapp", peerId: from, peerName: displayName });

  // Poll / quick-reply answer.
  if (msg.type === "interactive") {
    const replyId = msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id ?? "";
    const choice = msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? "";
    if (replyId && /^(qset|qopt):\d+$/.test(replyId)) {
      await recordMessage({ threadId, direction: "in", externalId: msg.id ?? null, kind: "text", text: `Chose: ${choice}`, senderName: displayName, status: "delivered" });
      const { handleQuizInteractive } = await import("@/lib/chat-quiz");
      after(() => handleQuizInteractive(threadId, "whatsapp", from, replyId));
      return;
    }
    if (choice) {
      await recordMessage({ threadId, direction: "in", externalId: msg.id ?? null, kind: "text", text: `Voted: ${choice}`, senderName: displayName, status: "delivered" });
      await recordPollVote(threadId, from, choice);
    }
    return;
  }

  const kind = KIND_MAP[msg.type] ?? "system";
  const mediaObj = (msg.image || msg.audio || msg.video || msg.document || msg.voice || msg.sticker) as WaMediaObj | undefined;
  const bodyText = msg.text?.body ?? mediaObj?.caption ?? null;
  const at = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date();

  const saved = await recordMessage({
    threadId,
    direction: "in",
    externalId: msg.id ?? null,
    kind: msg.type === "voice" ? "voice" : kind,
    text: bodyText,
    mediaMime: mediaObj?.mime_type ?? null,
    mediaName: mediaObj?.filename ?? null,
    providerRef: mediaObj?.id ? { waMediaId: mediaObj.id } : null,
    senderName: displayName,
    status: "delivered",
    at,
  });

  // Link-code flow for plain text that looks like a code.
  const code = kind === "text" ? parseLinkCode(bodyText ?? undefined) : null;
  if (!code) {
    if (saved && kind === "text" && bodyText) {
      const t = bodyText;
      after(async () => {
        const { maybeHandleQuiz } = await import("@/lib/chat-quiz");
        const rows = await query<{ userId: string | null }>(`SELECT user_id AS "userId" FROM chat_threads WHERE id=$1`, [threadId]);
        if (await maybeHandleQuiz(threadId, t, "whatsapp", from, rows[0]?.userId ?? null)) return;
        await maybeAutoReply(threadId, t);
      });
    }
    return;
  }
  const rows = await query<{ id: string; userId: string } & Record<string, unknown>>(
    `UPDATE messaging_channels
     SET status='linked', address=$1, handle=$2, link_code=NULL, link_code_expires_at=NULL, verified_at=now(), updated_at=now()
     WHERE platform='whatsapp' AND link_code=$3 AND (link_code_expires_at IS NULL OR link_code_expires_at > now())
     RETURNING id, user_id AS "userId"`,
    [from, `+${from}`, code],
  );
  if (!rows[0]) return;
  await query(
    `UPDATE messaging_channels SET status='disabled', address=NULL, updated_at=now()
     WHERE platform='whatsapp' AND address=$1 AND id <> $2`,
    [from, rows[0].id],
  );
  await logActivity({ action: "channel.link", userId: rows[0].userId, entityType: "channel", entityId: rows[0].id, metadata: { platform: "whatsapp" }, request });
  await sendWhatsAppText(from, "*Aperio linked.* You'll get roadmap reminders, a weekly digest, and analysis updates here. Manage them in Settings.").catch(() => {});
}
