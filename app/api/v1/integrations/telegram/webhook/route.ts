import { NextResponse, after } from "next/server";
import { query } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { maybeAutoReply } from "@/lib/assistant";
import { recordMessage, recordPollVote, upsertThread } from "@/lib/chat";
import { type TelegramUpdate, getTelegramConfig, parseLinkCode, sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Update extends TelegramUpdate {
  poll_answer?: { poll_id?: string; user?: { id?: number; username?: string }; option_ids?: number[] };
}

async function threadUserId(threadId: string) {
  const rows = await query<{ userId: string | null }>(`SELECT user_id AS "userId" FROM chat_threads WHERE id=$1`, [threadId]);
  return rows[0]?.userId ?? null;
}

// Telegram expects a fast 200 for every update; we always return ok:true.
export async function POST(request: Request) {
  const ok = () => NextResponse.json({ ok: true });

  const telegram = await getTelegramConfig();
  if (telegram.webhookSecret && request.headers.get("x-telegram-bot-api-secret-token") !== telegram.webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!telegram.configured) return ok();

  let update: Update;
  try {
    update = (await request.json()) as Update;
  } catch {
    return ok();
  }

  // Poll answers (non-anonymous polls sent by the bot).
  if (update.poll_answer?.poll_id) {
    const voter = String(update.poll_answer.user?.username ? `@${update.poll_answer.user.username}` : update.poll_answer.user?.id ?? "user");
    const optionIndex = update.poll_answer.option_ids?.[0];

    // Conversational practice quiz owns this poll?
    if (typeof optionIndex === "number") {
      const owned = await query<{ id: string }>(`SELECT id FROM chat_quiz_sessions WHERE pending_ref=$1 LIMIT 1`, [update.poll_answer.poll_id]);
      if (owned[0]) {
        const pid = update.poll_answer.poll_id;
        after(async () => {
          const { handleQuizPollAnswer } = await import("@/lib/chat-quiz");
          await handleQuizPollAnswer(pid, optionIndex);
        });
        return ok();
      }
    }

    const poll = await query<{ id: string; threadId: string; options: string[] }>(
      `SELECT id, thread_id AS "threadId", options FROM chat_polls WHERE external_id=$1 LIMIT 1`,
      [update.poll_answer.poll_id],
    );
    if (poll[0] && typeof optionIndex === "number") {
      await recordPollVote(poll[0].threadId, voter, poll[0].options[optionIndex] ?? String(optionIndex), optionIndex);
      await recordMessage({ threadId: poll[0].threadId, direction: "in", kind: "text", text: `Voted: ${poll[0].options[optionIndex] ?? optionIndex}`, senderName: voter, status: "delivered" });
    }
    return ok();
  }

  const message = update.message;
  const chatId = message?.chat?.id;
  if (!message || chatId === undefined) return ok();
  const chatIdStr = String(chatId);
  const handle = message.from?.username ? `@${message.from.username}` : message.chat?.first_name ?? null;
  const name = message.chat?.first_name || message.from?.username || chatIdStr;

  // Mirror the conversation into the chat workspace.
  const threadId = await upsertThread({
    channel: "telegram_bot",
    peerId: chatIdStr,
    peerName: name,
    peerUsername: message.from?.username ?? null,
  });
  const saved = message.text
    ? await recordMessage({ threadId, direction: "in", kind: "text", text: message.text, senderName: name, status: "delivered" })
    : null;

  const code = parseLinkCode(message.text);
  if (!code) {
    // Run the AI reply after the 200 so Telegram doesn't wait on Gemini, but
    // keep the function alive until it finishes (bare `void` gets frozen).
    if (saved && message.text) {
      const t = message.text;
      after(async () => {
        const { maybeHandleQuiz } = await import("@/lib/chat-quiz");
        const uid = await threadUserId(threadId);
        if (await maybeHandleQuiz(threadId, t, "telegram_bot", chatIdStr, uid)) return;
        await maybeAutoReply(threadId, t);
      });
    }
    return ok();
  }

  const rows = await query<{ id: string; userId: string } & Record<string, unknown>>(
    `UPDATE messaging_channels
     SET status='linked', via='bot', address=$1, handle=$2, link_code=NULL, link_code_expires_at=NULL, verified_at=now(), updated_at=now()
     WHERE platform='telegram' AND link_code=$3
       AND (link_code_expires_at IS NULL OR link_code_expires_at > now())
     RETURNING id, user_id AS "userId"`,
    [chatIdStr, handle, code],
  );

  if (!rows[0]) {
    await sendTelegramMessage(chatIdStr, "That code is invalid or expired. Generate a new one in Aperio settings.").catch(() => {});
    return ok();
  }

  await query(
    `UPDATE messaging_channels SET status='disabled', address=NULL, updated_at=now()
     WHERE platform='telegram' AND address=$1 AND id <> $2`,
    [chatIdStr, rows[0].id],
  );
  await logActivity({ action: "channel.link", userId: rows[0].userId, entityType: "channel", entityId: rows[0].id, metadata: { platform: "telegram" }, request });
  await sendTelegramMessage(
    chatIdStr,
    "<b>Aperio linked.</b>\nYou'll get reminders, a weekly digest, analysis updates, and any tests or polls here. Manage them in Settings.",
    { preformatted: true },
  ).catch(() => {});
  return ok();
}
