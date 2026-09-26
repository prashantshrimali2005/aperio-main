import "server-only";

import { randomUUID } from "node:crypto";
import { one, query } from "@/lib/db";

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

export type ChatChannel = "telegram_userbot" | "telegram_bot" | "whatsapp";
export type MessageKind = "text" | "image" | "audio" | "voice" | "video" | "file" | "sticker" | "system";

function previewFor(kind: MessageKind, text: string | null) {
  if (text) return text.slice(0, 140);
  return { image: "📷 Photo", video: "🎬 Video", audio: "🎵 Audio", voice: "🎤 Voice", file: "📎 File", sticker: "🌟 Sticker", system: "—", text: "" }[kind];
}

async function linkUser(channel: ChatChannel, peerId: string, peerUsername?: string | null) {
  if (channel === "whatsapp") {
    const digits = peerId.replace(/\D/g, "");
    const row = await one<{ userId: string }>(
      `SELECT user_id AS "userId" FROM messaging_channels WHERE platform='whatsapp' AND regexp_replace(COALESCE(address,''),'\\D','','g') = $1 LIMIT 1`,
      [digits],
    );
    if (row) return row.userId;
  }
  if (channel === "telegram_userbot" || channel === "telegram_bot") {
    const row = await one<{ userId: string }>(
      `SELECT user_id AS "userId" FROM messaging_channels WHERE platform='telegram' AND address = $1 LIMIT 1`,
      [peerId],
    );
    if (row) return row.userId;
    if (peerUsername) {
      const byHandle = await one<{ userId: string }>(
        `SELECT user_id AS "userId" FROM messaging_channels WHERE platform='telegram' AND lower(handle) = lower($1) LIMIT 1`,
        [`@${peerUsername.replace(/^@/, "")}`],
      );
      if (byHandle) return byHandle.userId;
    }
  }
  return null;
}

export async function upsertThread(input: {
  channel: ChatChannel;
  peerId: string;
  peerName?: string | null;
  peerUsername?: string | null;
  peerAccessHash?: string | null;
  peerType?: string | null;
}) {
  const existing = await one<{ id: string }>(
    `SELECT id FROM chat_threads WHERE channel=$1 AND peer_id=$2`,
    [input.channel, input.peerId],
  );
  if (existing) {
    await query(
      `UPDATE chat_threads SET peer_name=COALESCE($2,peer_name), peer_username=COALESCE($3,peer_username),
         peer_access_hash=COALESCE($4,peer_access_hash), peer_type=COALESCE($5,peer_type) WHERE id=$1`,
      [existing.id, input.peerName ?? null, input.peerUsername ?? null, input.peerAccessHash ?? null, input.peerType ?? null],
    );
    return existing.id;
  }
  const id = randomUUID();
  const userId = await linkUser(input.channel, input.peerId, input.peerUsername);
  await query(
    `INSERT INTO chat_threads (id, channel, peer_id, peer_name, peer_username, peer_access_hash, peer_type, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (channel, peer_id) DO NOTHING`,
    [id, input.channel, input.peerId, input.peerName ?? null, input.peerUsername ?? null, input.peerAccessHash ?? null, input.peerType ?? null, userId],
  );
  const row = await one<{ id: string }>(`SELECT id FROM chat_threads WHERE channel=$1 AND peer_id=$2`, [input.channel, input.peerId]);
  return row!.id;
}

export async function getThreadForSend(id: string) {
  return one<{ channel: ChatChannel; peerId: string; peerUsername: string | null; peerAccessHash: string | null; peerType: string | null } & Record<string, unknown>>(
    `SELECT channel, peer_id AS "peerId", peer_username AS "peerUsername",
       peer_access_hash AS "peerAccessHash", peer_type AS "peerType" FROM chat_threads WHERE id=$1`,
    [id],
  );
}

export async function storeMedia(input: { mime: string; name?: string | null; data: Buffer }) {
  if (input.data.length > MAX_MEDIA_BYTES) return null;
  const id = randomUUID();
  await query(
    `INSERT INTO chat_media (id, mime, name, size, data) VALUES ($1,$2,$3,$4,$5)`,
    [id, input.mime.slice(0, 120) || "application/octet-stream", input.name?.slice(0, 200) ?? null, input.data.length, input.data],
  );
  return id;
}

export async function getMedia(id: string) {
  return one<{ mime: string; name: string | null; data: Buffer }>(
    `SELECT mime, name, data FROM chat_media WHERE id=$1`,
    [id],
  );
}

export async function recordMessage(input: {
  threadId: string;
  direction: "in" | "out";
  externalId?: string | null;
  kind: MessageKind;
  text?: string | null;
  mediaId?: string | null;
  mediaMime?: string | null;
  mediaName?: string | null;
  mediaSize?: number | null;
  providerRef?: Record<string, unknown> | null;
  senderName?: string | null;
  status?: string;
  at?: Date;
}) {
  const id = randomUUID();
  const at = input.at ?? new Date();
  const rows = await query<{ id: string }>(
    `INSERT INTO chat_messages
       (id, thread_id, direction, external_id, kind, text, media_id, media_mime, media_name, media_size, provider_ref, sender_name, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)
     ON CONFLICT (thread_id, external_id) DO NOTHING
     RETURNING id`,
    [
      id, input.threadId, input.direction, input.externalId ?? null, input.kind, input.text ?? null,
      input.mediaId ?? null, input.mediaMime ?? null, input.mediaName ?? null, input.mediaSize ?? null,
      JSON.stringify(input.providerRef ?? null), input.senderName ?? null, input.status ?? (input.direction === "out" ? "sent" : "delivered"),
      at.toISOString(),
    ],
  );
  if (!rows[0]) return null; // duplicate
  await query(
    `UPDATE chat_threads SET
       last_message_at = GREATEST(COALESCE(last_message_at, to_timestamp(0)), $2),
       last_message_preview = $3,
       last_direction = $4,
       unread_count = CASE WHEN $4 = 'in' THEN unread_count + 1 ELSE unread_count END
     WHERE id = $1`,
    [input.threadId, at.toISOString(), previewFor(input.kind, input.text ?? null), input.direction],
  );
  return rows[0].id;
}

export async function updateMessageStatus(id: string, status: string, error?: string) {
  await query(`UPDATE chat_messages SET status=$2, error=$3 WHERE id=$1`, [id, status, error ?? null]);
}

/**
 * An outbound row is inserted as "pending" and flipped to "sent" once the
 * provider accepts it. If the serverless function is killed in between (slow
 * MTProto connect, timeout) the row stays "pending" forever and the UI spins.
 * Flip anything stuck for over a minute to "failed" so it stops spinning and
 * the admin can resend.
 */
export async function reapStalePendingOutbound(threadId?: string) {
  await query(
    `UPDATE chat_messages
        SET status='failed',
            error=COALESCE(error, 'Send timed out — no delivery confirmation. Try again.')
      WHERE direction='out' AND status='pending'
        AND created_at < now() - interval '70 seconds'
        ${threadId ? "AND thread_id=$1" : ""}`,
    threadId ? [threadId] : [],
  );
}

export async function listThreads(opts: { channel?: string; q?: string } = {}) {
  const c = opts.channel && opts.channel !== "all" ? opts.channel : null;
  const like = opts.q ? `%${opts.q.toLowerCase()}%` : null;
  return query<Record<string, unknown>>(
    `SELECT t.id, t.channel, t.peer_id AS "peerId", t.peer_name AS "peerName", t.peer_username AS "peerUsername",
       t.user_id AS "userId", u.full_name AS "userName", u.email AS "userEmail",
       t.last_message_at AS "lastMessageAt", t.last_message_preview AS "lastPreview", t.last_direction AS "lastDirection",
       t.unread_count AS "unreadCount", t.archived
     FROM chat_threads t LEFT JOIN users u ON u.id = t.user_id
     WHERE ($1::text IS NULL
            OR ($1 = 'telegram' AND t.channel LIKE 'telegram\\_%')
            OR t.channel = $1)
       AND ($2::text IS NULL OR lower(COALESCE(t.peer_name,'')) LIKE $2 OR lower(COALESCE(t.peer_username,'')) LIKE $2
            OR lower(COALESCE(u.full_name,'')) LIKE $2 OR lower(COALESCE(u.email,'')) LIKE $2 OR t.peer_id LIKE $2)
     ORDER BY t.last_message_at DESC NULLS LAST
     LIMIT 200`,
    [c, like],
  );
}

export async function getThread(id: string) {
  return one<Record<string, unknown>>(
    `SELECT t.id, t.channel, t.peer_id AS "peerId", t.peer_name AS "peerName", t.peer_username AS "peerUsername",
       t.user_id AS "userId", u.full_name AS "userName", u.email AS "userEmail", t.unread_count AS "unreadCount"
     FROM chat_threads t LEFT JOIN users u ON u.id = t.user_id WHERE t.id=$1`,
    [id],
  );
}

export async function getMessages(threadId: string, opts: { sinceId?: string; beforeId?: string; limit?: number } = {}) {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 60));
  if (opts.sinceId) {
    return query<Record<string, unknown>>(
      `SELECT * FROM (
         SELECT m.id, m.direction, m.kind, m.text, m.media_id AS "mediaId", m.media_mime AS "mediaMime",
           m.media_name AS "mediaName", m.media_size AS "mediaSize", m.sender_name AS "senderName", m.status, m.created_at AS "createdAt"
         FROM chat_messages m
         WHERE m.thread_id=$1 AND m.created_at > (SELECT created_at FROM chat_messages WHERE id=$2)
         ORDER BY m.created_at ASC LIMIT $3
       ) x ORDER BY x."createdAt" ASC`,
      [threadId, opts.sinceId, limit],
    );
  }
  return query<Record<string, unknown>>(
    `SELECT * FROM (
       SELECT m.id, m.direction, m.kind, m.text, m.media_id AS "mediaId", m.media_mime AS "mediaMime",
         m.media_name AS "mediaName", m.media_size AS "mediaSize", m.sender_name AS "senderName", m.status, m.created_at AS "createdAt"
       FROM chat_messages m
       WHERE m.thread_id=$1 ${opts.beforeId ? "AND m.created_at < (SELECT created_at FROM chat_messages WHERE id=$3)" : ""}
       ORDER BY m.created_at DESC LIMIT $2
     ) x ORDER BY x."createdAt" ASC`,
    opts.beforeId ? [threadId, limit, opts.beforeId] : [threadId, limit],
  );
}

export async function markThreadRead(threadId: string) {
  await query(`UPDATE chat_threads SET unread_count=0 WHERE id=$1`, [threadId]);
}

export async function maxExternalId(threadId: string) {
  const row = await one<{ ext: string | null }>(
    `SELECT MAX((external_id)::bigint)::text AS ext FROM chat_messages WHERE thread_id=$1 AND external_id ~ '^[0-9]+$'`,
    [threadId],
  );
  return row?.ext ? Number(row.ext) : 0;
}

// --- polls ---------------------------------------------------------------

export async function createPoll(input: {
  threadId: string;
  messageId: string | null;
  channel: string;
  externalId?: string | null;
  question: string;
  options: string[];
  createdBy?: string | null;
}) {
  const id = randomUUID();
  await query(
    `INSERT INTO chat_polls (id, thread_id, message_id, channel, external_id, question, options, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [id, input.threadId, input.messageId ?? null, input.channel, input.externalId ?? null, input.question.slice(0, 400), JSON.stringify(input.options.slice(0, 12)), input.createdBy ?? null],
  );
  return id;
}

/** Record a vote against the most recent poll in the thread (WhatsApp buttons / Telegram poll answers). */
export async function recordPollVote(threadId: string, voter: string, optionText: string, optionIndex?: number) {
  const poll = await one<{ id: string; options: string[] }>(
    `SELECT id, options FROM chat_polls WHERE thread_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [threadId],
  );
  if (!poll) return;
  const idx = optionIndex ?? poll.options.findIndex((o) => o.toLowerCase() === optionText.toLowerCase());
  await query(
    `INSERT INTO chat_poll_votes (id, poll_id, voter, option_index, option_text)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (poll_id, voter) DO UPDATE SET option_index=EXCLUDED.option_index, option_text=EXCLUDED.option_text, created_at=now()`,
    [randomUUID(), poll.id, voter, idx >= 0 ? idx : null, optionText.slice(0, 200)],
  );
}

export async function getThreadPolls(threadId: string) {
  return query<Record<string, unknown>>(
    `SELECT p.id, p.question, p.options, p.created_at AS "createdAt",
       COALESCE(json_agg(json_build_object('voter', v.voter, 'optionIndex', v.option_index, 'optionText', v.option_text))
                FILTER (WHERE v.id IS NOT NULL), '[]') AS votes
     FROM chat_polls p LEFT JOIN chat_poll_votes v ON v.poll_id = p.id
     WHERE p.thread_id=$1 GROUP BY p.id ORDER BY p.created_at DESC LIMIT 20`,
    [threadId],
  );
}
