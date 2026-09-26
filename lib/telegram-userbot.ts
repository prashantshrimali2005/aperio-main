import "server-only";

import { randomUUID } from "node:crypto";

import { getIntegrationRuntime, setRawSecrets, type IntegrationKey } from "@/lib/settings";
import { one, query } from "@/lib/db";
import { parseLinkCode } from "@/lib/telegram";
import {
  MAX_MEDIA_BYTES,
  getThreadForSend,
  maxExternalId,
  recordMessage,
  storeMedia,
  upsertThread,
  type MessageKind,
} from "@/lib/chat";

/* eslint-disable @typescript-eslint/no-explicit-any */

const KEY: IntegrationKey = "telegram.userbot";
const CONNECT_RETRIES = 3;

// teleproto is a heavy MTProto library — load it only when a userbot action
// actually runs, never at module import time (keeps it out of every bundle).
let _tp: any = null;
async function tp() {
  if (!_tp) _tp = await import("teleproto");
  return _tp;
}

async function makeClient(apiId: number, apiHash: string, session: string) {
  const { TelegramClient, sessions } = await tp();
  return new TelegramClient(new sessions.StringSession(session), apiId, apiHash, {
    connectionRetries: CONNECT_RETRIES,
    // never let a client silently reconnect after we think it's closed — a
    // lingering connection on the same session is what Telegram kills.
    autoReconnect: false,
    deviceModel: "Aperio",
    systemVersion: "1.0",
    appVersion: "1.0",
  });
}

// --- session lease: only one live MTProto client per stored session ---------

const LOCK_TTL_SEC = 90;
const FATAL_SESSION =
  /AUTH_KEY_UNREGISTERED|AUTH_KEY_DUPLICATED|SESSION_REVOKED|SESSION_EXPIRED|Concurrent usage|USER_DEACTIVATED|key is not registered/i;

async function acquireLock(waitMs: number): Promise<string | null> {
  const holder = randomUUID();
  const deadline = Date.now() + Math.max(0, waitMs);
  for (;;) {
    const rows = await query<{ holder: string }>(
      `UPDATE userbot_lock SET holder = $1, acquired_at = now()
       WHERE id = 1 AND (holder IS NULL OR acquired_at < now() - make_interval(secs => $2))
       RETURNING holder`,
      [holder, LOCK_TTL_SEC],
    ).catch(() => [] as { holder: string }[]);
    if (rows[0]?.holder === holder) return holder;
    if (Date.now() >= deadline) return null;
    await new Promise((r) => setTimeout(r, 1_500));
  }
}

async function releaseLock(holder: string) {
  await query(`UPDATE userbot_lock SET holder = NULL, acquired_at = NULL WHERE holder = $1`, [holder]).catch(() => {});
}

/**
 * Run `fn` with the one and only connected user-bot client. Serialised across
 * the whole deployment by a DB lease so a send never races a sync on the same
 * session. `waitMs: 0` makes opportunistic callers (sync) bail instead of queue.
 */
async function withUserbot<T>(opts: { waitMs?: number }, fn: (client: any) => Promise<T>): Promise<T> {
  const { apiId, apiHash, rt } = await creds();
  const session = rt.secret("stringSession");
  if (!apiId || !apiHash || !session) throw new Error("USERBOT_NOT_LOGGED_IN");

  const lock = await acquireLock(opts.waitMs ?? 45_000);
  if (!lock) throw new Error("USERBOT_BUSY");

  const client = await makeClient(apiId, apiHash, session);
  try {
    await client.connect();
    const fresh = client.session.save();
    if (typeof fresh === "string" && fresh.length > 20 && fresh !== session) {
      await setRawSecrets(KEY, { stringSession: fresh, _sessionError: null }).catch(() => {});
    }
    return await fn(client);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (FATAL_SESSION.test(msg)) {
      await setRawSecrets(KEY, { _sessionError: msg.slice(0, 300) }).catch(() => {});
    }
    throw error;
  } finally {
    await client.disconnect().catch(() => {});
    await releaseLock(lock);
  }
}

async function creds() {
  const rt = await getIntegrationRuntime(KEY);
  const apiId = Number(rt.config.apiId ?? 0);
  const apiHash = rt.secret("apiHash") ?? "";
  const phone = String(rt.config.phone ?? "").trim();
  return { apiId, apiHash, phone, rt };
}

/** Step 1: send the login code to the configured phone. */
export async function sendUserbotLoginCode() {
  const { apiId, apiHash, phone } = await creds();
  if (!apiId || !apiHash || !phone) throw new Error("USERBOT_CREDS_MISSING");

  const client = await makeClient(apiId, apiHash, "");
  try {
    await client.connect();
    const result = await client.sendCode({ apiId, apiHash }, phone);
    await setRawSecrets(KEY, {
      _pendingCodeHash: result.phoneCodeHash,
      _pendingSession: client.session.save(),
    });
    return { sent: true, viaApp: Boolean(result.isCodeViaApp) };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

/** Step 2: complete the login with the OTP (and 2FA password if the account has one). */
export async function signInUserbot(code: string, password?: string) {
  const { apiId, apiHash, phone, rt } = await creds();
  if (!apiId || !apiHash || !phone) throw new Error("USERBOT_CREDS_MISSING");
  const phoneCodeHash = rt.secret("_pendingCodeHash");
  const pendingSession = rt.secret("_pendingSession");
  if (!phoneCodeHash || !pendingSession) throw new Error("NO_PENDING_LOGIN");

  const { Api, password: tgPassword } = await tp();
  const client = await makeClient(apiId, apiHash, pendingSession);
  try {
    await client.connect();
    try {
      await client.invoke(new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("SESSION_PASSWORD_NEEDED")) {
        if (!password) throw new Error("PASSWORD_REQUIRED");
        const pwd = await client.invoke(new Api.account.GetPassword());
        const check = await tgPassword.computeCheck(pwd, password);
        await client.invoke(new Api.auth.CheckPassword({ password: check }));
      } else if (message.includes("PHONE_CODE_INVALID") || message.includes("PHONE_CODE_EXPIRED")) {
        throw new Error("PHONE_CODE_INVALID");
      } else {
        throw error;
      }
    }

    const me = await client.getMe();
    await setRawSecrets(KEY, {
      stringSession: client.session.save(),
      username: me?.username ?? "",
      _pendingCodeHash: null,
      _pendingSession: null,
      _sessionError: null,
    });
    return {
      linked: true,
      me: {
        id: String(me?.id ?? ""),
        username: me?.username ?? null,
        firstName: me?.firstName ?? null,
        phone: me?.phone ?? null,
      },
    };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

/** Connection test using the stored session. */
export async function testUserbot() {
  const { apiId, apiHash, rt } = await creds();
  if (!apiId || !apiHash) return { ok: false, detail: "Add the API ID and API hash first." };
  if (!rt.secret("stringSession")) return { ok: false, detail: "Not logged in yet — send an OTP and sign in below." };

  try {
    return await withUserbot({ waitMs: 25_000 }, async (client) => {
      const me = await client.getMe();
      return { ok: true, detail: `Logged in as ${me?.username ? `@${me.username}` : me?.firstName ?? "user"}` };
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Connection failed.";
    if (detail === "USERBOT_BUSY") return { ok: false, detail: "Busy syncing — try again in a few seconds." };
    if (FATAL_SESSION.test(detail)) return { ok: false, detail: "Session was invalidated by Telegram. Send a new OTP and sign in again." };
    return { ok: false, detail };
  }
}

export async function userbotStatus() {
  const rt = await getIntegrationRuntime(KEY);
  return {
    hasCreds: Boolean(rt.config.apiId && rt.secret("apiHash") && rt.config.phone),
    loggedIn: Boolean(rt.secret("stringSession")),
    pending: Boolean(rt.secret("_pendingCodeHash")),
    phone: String(rt.config.phone ?? ""),
    username: (rt.secret("username") ?? "").replace(/^@/, ""),
    sessionError: rt.secret("_sessionError") || null,
  };
}

// --- chat workspace: sync + send -----------------------------------------

function mediaKind(msg: any): { kind: MessageKind; mime: string; name: string | null } | null {
  if (msg.photo) return { kind: "image", mime: "image/jpeg", name: null };
  if (msg.sticker) return { kind: "sticker", mime: "image/webp", name: null };
  if (msg.voice) return { kind: "voice", mime: "audio/ogg", name: null };
  if (msg.video || msg.videoNote || msg.gif) return { kind: "video", mime: "video/mp4", name: null };
  if (msg.audio) return { kind: "audio", mime: msg.audio.mimeType || "audio/mpeg", name: msg.audio.attributes?.find?.((a: any) => a.fileName)?.fileName ?? null };
  if (msg.document) {
    const mime = msg.document.mimeType || "application/octet-stream";
    const name = msg.document.attributes?.find?.((a: any) => a.fileName)?.fileName ?? null;
    const kind: MessageKind = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "file";
    return { kind, mime, name };
  }
  return null;
}

function peerTypeOf(entity: any): "user" | "chat" | "channel" {
  if (entity?.className === "Channel") return "channel";
  if (entity?.className === "Chat") return "chat";
  return "user";
}

export async function syncUserbotMessages(perDialog = 25, maxDialogs = 40, opts: { budgetMs?: number } = {}) {
  const budgetMs = opts.budgetMs ?? 45_000;
  const lock = await query<{ ok: boolean }>(
    `INSERT INTO chat_sync_state (channel, running, synced_at) VALUES ('telegram_userbot', true, now())
     ON CONFLICT (channel) DO UPDATE SET running = true, synced_at = now()
     WHERE chat_sync_state.running = false OR chat_sync_state.synced_at < now() - interval '90 seconds'
     RETURNING true AS ok`,
  );
  if (!lock[0]) return { skipped: true };

  let stored = 0;
  const replyQueue: Array<{ threadId: string; text: string }> = [];
  try {
    await withUserbot({ waitMs: 0 }, async (client) => {
    const startedAt = Date.now();
    const dialogs = await client.getDialogs({ limit: maxDialogs });
    for (const dialog of dialogs) {
      // Hard time budget: never hold the session lock long enough to make a
      // concurrent send time out. Remaining dialogs are picked up next run.
      if (Date.now() - startedAt > budgetMs) break;
      const entity: any = dialog.entity;
      if (!entity || peerTypeOf(entity) === "channel") continue;
      const peerId = String(dialog.id);
      const name = (dialog as any).name || [entity.firstName, entity.lastName].filter(Boolean).join(" ") || entity.title || peerId;
      const threadId = await upsertThread({
        channel: "telegram_userbot",
        peerId,
        peerName: name,
        peerUsername: entity.username ?? null,
        peerAccessHash: entity.accessHash != null ? String(entity.accessHash) : null,
        peerType: peerTypeOf(entity),
      });

      const minId = await maxExternalId(threadId);
      const messages = await client.getMessages(entity, { limit: perDialog, minId });
      for (const msg of [...messages].reverse()) {
        if (!msg?.id) continue;

        // A user who linked Telegram via the user bot messages it their code.
        if (!msg.out && peerTypeOf(entity) === "user") {
          const code = parseLinkCode(msg.message ?? undefined);
          if (code) {
            const linked = await query<{ id: string; userId: string } & Record<string, unknown>>(
              `UPDATE messaging_channels
               SET status='linked', via='userbot', address=$1, peer_access_hash=$2, handle=$3,
                   link_code=NULL, link_code_expires_at=NULL, verified_at=now(), updated_at=now()
               WHERE platform='telegram' AND link_code=$4 AND (link_code_expires_at IS NULL OR link_code_expires_at > now())
               RETURNING id, user_id AS "userId"`,
              [peerId, entity.accessHash != null ? String(entity.accessHash) : null, entity.username ? `@${entity.username}` : name, code],
            );
            if (linked[0]) {
              await query(
                `UPDATE messaging_channels SET status='disabled', address=NULL, updated_at=now()
                 WHERE platform='telegram' AND address=$1 AND id <> $2`,
                [peerId, linked[0].id],
              );
              await client.sendMessage(entity, {
                message: "Aperio linked. You'll get roadmap reminders, a weekly digest, analysis updates, and any tests or polls here. Manage them in Settings.",
              }).catch(() => {});
            }
          }
        }

        const media = mediaKind(msg);
        let mediaId: string | null = null;
        let mediaSize: number | null = null;
        if (media) {
          try {
            const buf = (await client.downloadMedia(msg, {})) as Buffer | undefined;
            if (buf && buf.length && buf.length <= MAX_MEDIA_BYTES) {
              mediaId = await storeMedia({ mime: media.mime, name: media.name, data: buf });
              mediaSize = buf.length;
            } else if (buf) {
              mediaSize = buf.length;
            }
          } catch {
            /* leave media undownloaded */
          }
        }
        const at = msg.date ? new Date(msg.date * 1000) : new Date();
        const saved = await recordMessage({
          threadId,
          direction: msg.out ? "out" : "in",
          externalId: String(msg.id),
          kind: media ? media.kind : "text",
          text: msg.message || null,
          mediaId,
          mediaMime: media?.mime ?? null,
          mediaName: media?.name ?? null,
          mediaSize,
          senderName: msg.out ? "You" : name,
          status: msg.out ? "sent" : "delivered",
          at,
        });
        if (saved) {
          stored += 1;
          // auto-reply only to fresh inbound text, never to a backlog — but
          // queue it and run it AFTER the session lock is released so the
          // reply's own send doesn't fight this sync for the lock.
          if (!msg.out && msg.message && Date.now() - at.getTime() < 12 * 60_000) {
            replyQueue.push({ threadId, text: msg.message });
          }
        }
      }
    }
    });

    if (replyQueue.length) {
      const { maybeAutoReply } = await import("@/lib/assistant");
      const { maybeHandleQuiz } = await import("@/lib/chat-quiz");
      for (const item of replyQueue) {
        const t = await one<{ peerId: string; userId: string | null }>(
          `SELECT peer_id AS "peerId", user_id AS "userId" FROM chat_threads WHERE id=$1`,
          [item.threadId],
        );
        if (t && (await maybeHandleQuiz(item.threadId, item.text, "telegram_userbot", t.peerId, t.userId))) continue;
        await maybeAutoReply(item.threadId, item.text);
      }
    }
    await query(`UPDATE chat_sync_state SET running=false, detail=$1, synced_at=now() WHERE channel='telegram_userbot'`, [`ok, ${stored} new`]);
    return { stored };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "error";
    await query(`UPDATE chat_sync_state SET running=false, detail=$1 WHERE channel='telegram_userbot'`, [msg.slice(0, 200)]);
    if (msg === "USERBOT_BUSY") return { skipped: true, reason: "busy" };
    if (msg === "USERBOT_NOT_LOGGED_IN") return { skipped: true, reason: "not_logged_in" };
    throw error;
  }
}

function resolvePeer(Api: any, thread: { peerUsername: string | null; peerId: string; peerAccessHash: string | null; peerType: string | null }) {
  if (thread.peerUsername) return `@${thread.peerUsername.replace(/^@/, "")}`;
  const id = BigInt(thread.peerId.replace("-100", "").replace("-", ""));
  const hash = thread.peerAccessHash ? BigInt(thread.peerAccessHash) : 0n;
  if (thread.peerType === "channel") return new Api.InputPeerChannel({ channelId: id, accessHash: hash });
  if (thread.peerType === "chat") return new Api.InputPeerChat({ chatId: id });
  return new Api.InputPeerUser({ userId: id, accessHash: hash });
}

function messageIdFromUpdates(updates: any): string | null {
  const list = updates?.updates ?? (Array.isArray(updates) ? updates : []);
  for (const u of list) {
    if (u?.className === "UpdateMessageID" && u.id != null) return String(u.id);
    if (u?.message?.id != null) return String(u.message.id);
  }
  return updates?.id != null ? String(updates.id) : null;
}

export async function sendUserbotMessage(threadId: string, input: { text?: string; file?: { data: Buffer; mime: string; name: string } }) {
  const thread = await getThreadForSend(threadId);
  if (!thread || thread.channel !== "telegram_userbot") throw new Error("THREAD_NOT_FOUND");
  const { Api } = await tp();
  return withUserbot({ waitMs: 45_000 }, async (client) => {
    const peer = resolvePeer(Api, thread);
    let sent: any;
    if (input.file) {
      sent = await client.sendFile(peer, {
        file: input.file.data,
        caption: input.text || undefined,
        forceDocument: !/^(image|video|audio)\//.test(input.file.mime),
        attributes: [new Api.DocumentAttributeFilename({ fileName: input.file.name || "file" })],
      });
    } else {
      sent = await client.sendMessage(peer, { message: input.text || "" });
    }
    const msg = Array.isArray(sent) ? sent[0] : sent;
    return { externalId: msg?.id != null ? String(msg.id) : null };
  });
}

/** Send a real native Telegram poll (non-anonymous) through the user bot. */
export async function sendUserbotPoll(threadId: string, question: string, options: string[]) {
  const thread = await getThreadForSend(threadId);
  if (!thread || thread.channel !== "telegram_userbot") throw new Error("THREAD_NOT_FOUND");
  const { Api, helpers } = await tp();
  return withUserbot({ waitMs: 45_000 }, async (client) => {
    const peer = resolvePeer(Api, thread);
    const poll = new Api.Poll({
      id: helpers.generateRandomBigInt(),
      publicVoters: true,
      question: new Api.TextWithEntities({ text: question.slice(0, 255), entities: [] }),
      answers: options.slice(0, 10).map((text, i) => new Api.PollAnswer({
        text: new Api.TextWithEntities({ text: text.slice(0, 100), entities: [] }),
        option: Buffer.from([i]),
      })),
    });
    const updates = await client.invoke(new Api.messages.SendMedia({
      peer,
      media: new Api.InputMediaPoll({ poll }),
      message: "",
      randomId: helpers.generateRandomBigInt(),
    }));
    return { externalId: messageIdFromUpdates(updates) };
  });
}

/** Direct send to a Telegram user by their id + access hash (used by notifications). */
export async function sendUserbotDirect(address: string, accessHash: string | null, text: string) {
  const { Api } = await tp();
  await withUserbot({ waitMs: 45_000 }, async (client) => {
    const peer = new Api.InputPeerUser({
      userId: BigInt(address.replace(/\D/g, "")),
      accessHash: accessHash ? BigInt(accessHash) : 0n,
    });
    await client.sendMessage(peer, { message: text });
  });
}

export async function isUserbotLoggedIn() {
  return (await userbotStatus()).loggedIn;
}
