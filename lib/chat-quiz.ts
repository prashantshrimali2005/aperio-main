import "server-only";

import { randomUUID } from "node:crypto";
import { one, query } from "@/lib/db";
import { recordMessage } from "@/lib/chat";

/* Conversational practice quiz over WhatsApp / Telegram bot.
   Flow: user asks for a "test" -> pick a set from a tappable list ->
   answer each question by tapping an option -> get a score. Questions and
   finished sets are never shown again in the same thread. */

// Deliberately narrow: the message is basically just the request, not a
// sentence that happens to contain "test".
const START_INTENT = /^(?:can i |i want (?:a |to )?|give me (?:a |the )?|start (?:a |the )?|let'?s (?:do |start )?|do (?:a )?|new )?(?:practice ?)?(?:test|tests|quiz|quizzes|mcq|mcqs|question set|question sets|practice|questions)\b[\s.!?]*$/i;
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

type Channel = "whatsapp" | "telegram_bot" | "telegram_userbot";

interface Session {
  id: string;
  threadId: string;
  userId: string | null;
  setId: string | null;
  stage: "choosing_set" | "in_progress" | "done" | "abandoned";
  questionIds: string[];
  currentIndex: number;
  correct: number;
  answers: Array<{ itemId: string; chosen: number; correct: boolean }>;
  pendingKind: "set_list" | "question" | null;
  pendingRef: string | null;
  pendingMeta: Record<string, unknown> | null;
}

function rowSession(r: Record<string, unknown>): Session {
  return {
    id: String(r.id),
    threadId: String(r.threadId),
    userId: r.userId ? String(r.userId) : null,
    setId: r.setId ? String(r.setId) : null,
    stage: r.stage as Session["stage"],
    questionIds: Array.isArray(r.questionIds) ? (r.questionIds as string[]) : [],
    currentIndex: Number(r.currentIndex ?? 0),
    correct: Number(r.correct ?? 0),
    answers: Array.isArray(r.answers) ? (r.answers as Session["answers"]) : [],
    pendingKind: (r.pendingKind as Session["pendingKind"]) ?? null,
    pendingRef: r.pendingRef ? String(r.pendingRef) : null,
    pendingMeta: (r.pendingMeta as Record<string, unknown>) ?? null,
  };
}

export async function getActiveQuizSession(threadId: string): Promise<Session | null> {
  // Auto-expire a quiz left untouched for 45 minutes so it stops intercepting.
  await query(
    `UPDATE chat_quiz_sessions SET stage='abandoned', pending_kind=NULL, pending_ref=NULL
      WHERE thread_id=$1 AND stage IN ('choosing_set','in_progress') AND updated_at < now() - interval '45 minutes'`,
    [threadId],
  );
  const r = await one<Record<string, unknown>>(
    `SELECT id, thread_id AS "threadId", user_id AS "userId", set_id AS "setId", stage,
       question_ids AS "questionIds", current_index AS "currentIndex", correct, answers,
       pending_kind AS "pendingKind", pending_ref AS "pendingRef", pending_meta AS "pendingMeta"
     FROM chat_quiz_sessions
     WHERE thread_id = $1 AND stage IN ('choosing_set', 'in_progress')
     ORDER BY started_at DESC LIMIT 1`,
    [threadId],
  );
  return r ? rowSession(r) : null;
}

async function getSessionByPendingRef(pendingRef: string): Promise<Session | null> {
  const r = await one<Record<string, unknown>>(
    `SELECT id, thread_id AS "threadId", user_id AS "userId", set_id AS "setId", stage,
       question_ids AS "questionIds", current_index AS "currentIndex", correct, answers,
       pending_kind AS "pendingKind", pending_ref AS "pendingRef", pending_meta AS "pendingMeta"
     FROM chat_quiz_sessions
     WHERE pending_ref = $1 AND stage IN ('choosing_set', 'in_progress')
     ORDER BY started_at DESC LIMIT 1`,
    [pendingRef],
  );
  return r ? rowSession(r) : null;
}

async function saveSession(id: string, patch: Partial<{
  setId: string | null;
  stage: Session["stage"];
  questionIds: string[];
  currentIndex: number;
  correct: number;
  answers: Session["answers"];
  pendingKind: string | null;
  pendingRef: string | null;
  pendingMeta: Record<string, unknown> | null;
  finished: boolean;
}>) {
  const sets: string[] = ["updated_at = now()"];
  const vals: unknown[] = [id];
  const add = (sql: string, v: unknown) => {
    vals.push(v);
    sets.push(`${sql} = $${vals.length}`);
  };
  if (patch.setId !== undefined) add("set_id", patch.setId);
  if (patch.stage !== undefined) add("stage", patch.stage);
  if (patch.questionIds !== undefined) add("question_ids", JSON.stringify(patch.questionIds));
  if (patch.currentIndex !== undefined) add("current_index", patch.currentIndex);
  if (patch.correct !== undefined) add("correct", patch.correct);
  if (patch.answers !== undefined) add("answers", JSON.stringify(patch.answers));
  if (patch.pendingKind !== undefined) add("pending_kind", patch.pendingKind);
  if (patch.pendingRef !== undefined) add("pending_ref", patch.pendingRef);
  if (patch.pendingMeta !== undefined) add("pending_meta", patch.pendingMeta ? JSON.stringify(patch.pendingMeta) : null);
  if (patch.finished) sets.push("finished_at = now()");
  await query(`UPDATE chat_quiz_sessions SET ${sets.join(", ")} WHERE id = $1`, vals);
}

// --- channel adapters: present a single-choice list, return a correlation ref ---

// Plain-text fallback when a tappable list / poll can't be sent (provider
// error, option too long, …). resolveChoiceIndex already accepts a typed
// letter, so the flow keeps working — just without the tap UI.
async function sendChoiceText(
  channel: Channel,
  peerId: string,
  body: string,
  options: Array<{ label: string; sub?: string }>,
) {
  const lines = options.map((o, i) => `${LETTERS[i] ?? i + 1}. ${o.label}${o.sub ? ` — ${o.sub}` : ""}`);
  await sendPlain(channel, peerId, `${body}\n\n${lines.join("\n")}\n\nReply with a letter (A, B, C…).`);
}

async function presentChoices(
  channel: Channel,
  peerId: string,
  header: string,
  body: string,
  options: Array<{ label: string; sub?: string }>,
  idPrefix: string,
  letterTitles = false,
): Promise<{ ref: string | null }> {
  if (channel === "whatsapp") {
    try {
      const { sendWhatsAppChoiceList } = await import("@/lib/whatsapp");
      const ref = await sendWhatsAppChoiceList(
        peerId,
        header,
        body,
        options.map((o, i) =>
          letterTitles
            ? { id: `${idPrefix}:${i}`, title: LETTERS[i] ?? String(i + 1), description: o.label }
            : { id: `${idPrefix}:${i}`, title: o.label, description: o.sub },
        ),
      );
      return { ref };
    } catch (error) {
      console.error("quiz: whatsapp choice list failed, falling back to text", error instanceof Error ? error.message : error);
      await sendChoiceText(channel, peerId, body, options);
      return { ref: null };
    }
  }
  if (channel === "telegram_bot") {
    try {
      const { sendTelegramMessage, sendTelegramPoll } = await import("@/lib/telegram");
      if (body.length > 240) await sendTelegramMessage(peerId, body).catch(() => {});
      const pollQuestion = body.length > 240 ? header : `${header}\n${body}`.slice(0, 290) || header;
      const pollId = await sendTelegramPoll(
        peerId,
        pollQuestion,
        options.map((o, i) => `${LETTERS[i] ?? i + 1}. ${o.label}${o.sub ? ` — ${o.sub}` : ""}`),
      );
      return { ref: pollId };
    } catch (error) {
      console.error("quiz: telegram poll failed, falling back to text", error instanceof Error ? error.message : error);
      await sendChoiceText(channel, peerId, body, options);
      return { ref: null };
    }
  }
  // telegram_userbot: a user account can't capture taps on its own poll —
  // handled by the caller (redirect to the bot).
  return { ref: null };
}

// --- available sets -------------------------------------------------------

async function availableSets(threadId: string, userId: string | null) {
  return query<{ id: string; title: string; niche: string; questionCount: number; priceInr: number }>(
    `SELECT s.id, s.title, s.niche, s.question_count AS "questionCount", s.price_inr AS "priceInr"
       FROM question_sets s
      WHERE s.published = true
        AND s.question_count > 0
        AND (s.price_inr <= 0 OR ($2::text IS NOT NULL AND EXISTS (
              SELECT 1 FROM payments p WHERE p.user_id = $2 AND p.item_type = 'question_set' AND p.item_id = s.id AND p.status = 'paid')))
        AND NOT EXISTS (
              SELECT 1 FROM chat_quiz_sessions q WHERE q.thread_id = $1 AND q.set_id = s.id AND q.stage = 'done')
        AND EXISTS (
              SELECT 1 FROM question_set_items it
               WHERE it.set_id = s.id
                 AND it.id NOT IN (SELECT item_id FROM chat_quiz_seen WHERE thread_id = $1))
      ORDER BY s.niche, s.created_at DESC
      LIMIT 10`,
    [threadId, userId],
  );
}

// --- flow ---------------------------------------------------------------

async function logSystem(threadId: string, text: string) {
  await recordMessage({ threadId, direction: "out", kind: "system", text, senderName: "Aperio", status: "sent" }).catch(() => {});
}

async function startQuiz(threadId: string, channel: Channel, peerId: string, userId: string | null): Promise<boolean> {
  if (channel === "telegram_userbot") {
    const { botUsername } = await import("@/lib/telegram").then((m) => m.getTelegramConfig());
    const where = botUsername ? `open @${botUsername} and send "test" there` : "use the web app: Learn → Practice";
    await sendPlain(channel, peerId, `Practice tests run through our bot — ${where}.`);
    return true;
  }

  const sets = await availableSets(threadId, userId);
  if (!sets.length) {
    await sendPlain(channel, peerId, "No new practice sets for you right now — you've done the ones available, or new ones aren't published yet.");
    return true;
  }

  const id = randomUUID();
  await query(
    `INSERT INTO chat_quiz_sessions (id, thread_id, user_id, stage, pending_kind, pending_meta)
     VALUES ($1, $2, $3, 'choosing_set', 'set_list', $4::jsonb)`,
    [id, threadId, userId, JSON.stringify({ sets: sets.map((s) => ({ id: s.id, title: s.title })) })],
  );

  const base: Session = {
    id, threadId, userId, setId: null, stage: "choosing_set", questionIds: [], currentIndex: 0, correct: 0,
    answers: [], pendingKind: "set_list", pendingRef: null,
    pendingMeta: { sets: sets.map((s) => ({ id: s.id, title: s.title })) },
  };

  // Only one set available — just start it.
  if (sets.length === 1) {
    await advance(base, channel, peerId, 0);
    return true;
  }

  const { ref } = await presentChoices(
    channel,
    peerId,
    "Practice test",
    "Pick a set to start:",
    sets.map((s) => ({ label: s.title, sub: `${s.questionCount} Qs · ${s.niche}` })),
    "qset",
  );
  await saveSession(id, { pendingRef: ref });
  await logSystem(threadId, `📝 Practice test — offered ${sets.length} set(s).`);
  return true;
}

async function sendPlain(channel: Channel, peerId: string, text: string) {
  if (channel === "whatsapp") {
    const { sendWhatsAppText } = await import("@/lib/whatsapp");
    await sendWhatsAppText(peerId, text).catch(() => {});
  } else if (channel === "telegram_bot") {
    const { sendTelegramMessage } = await import("@/lib/telegram");
    await sendTelegramMessage(peerId, text).catch(() => {});
  } else {
    const { sendUserbotMessage } = await import("@/lib/telegram-userbot");
    const t = await one<{ id: string }>(`SELECT id FROM chat_threads WHERE peer_id=$1 AND channel='telegram_userbot' LIMIT 1`, [peerId]);
    if (t) await sendUserbotMessage(t.id, { text }).catch(() => {});
  }
}

async function askQuestion(session: Session, channel: Channel, peerId: string) {
  const qId = session.questionIds[session.currentIndex];
  const item = await one<{ prompt: string; options: string[]; correctIndex: number }>(
    `SELECT prompt, options, correct_index AS "correctIndex" FROM question_set_items WHERE id = $1`,
    [qId],
  );
  if (!item) return finishQuiz(session, channel, peerId);

  const total = session.questionIds.length;
  const header = `Q${session.currentIndex + 1}/${total}`;
  const { ref } = await presentChoices(
    channel,
    peerId,
    header,
    `${header}: ${item.prompt}`,
    item.options.map((o) => ({ label: o })),
    "qopt",
    true,
  );

  await query(
    `INSERT INTO chat_quiz_seen (thread_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [session.threadId, qId],
  );
  await saveSession(session.id, {
    pendingKind: "question",
    pendingRef: ref,
    pendingMeta: { itemId: qId, correctIndex: item.correctIndex, options: item.options },
  });
  await logSystem(session.threadId, `📝 ${header}: ${item.prompt}`);
}

async function finishQuiz(session: Session, channel: Channel, peerId: string) {
  const total = session.questionIds.length || 1;
  const score = Math.round((session.correct / total) * 100);
  await saveSession(session.id, { stage: "done", pendingKind: null, pendingRef: null, pendingMeta: null, finished: true });

  if (session.setId) {
    await query(
      `INSERT INTO question_set_attempts (id, user_id, set_id, score, correct, total, answers)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        randomUUID(),
        session.userId ?? null,
        session.setId,
        score,
        session.correct,
        session.questionIds.length,
        JSON.stringify(session.answers.map((a) => ({ q: a.itemId, a: a.chosen }))),
      ],
    ).catch(() => {});
  }

  const verdict = score >= 80 ? "Strong work." : score >= 50 ? "Decent — worth another pass." : "Keep at it.";
  await sendPlain(channel, peerId, `Test complete: ${session.correct}/${session.questionIds.length} correct — ${score}%. ${verdict}\nSend "test" for another set.`);
  await logSystem(session.threadId, `✅ Test complete — ${session.correct}/${session.questionIds.length} (${score}%).`);
}

/** Resolve a reply to an option index for the current pending choice. */
function resolveChoiceIndex(session: Session, input: { index?: number; text?: string }): number | null {
  if (typeof input.index === "number" && input.index >= 0) return input.index;
  const raw = (input.text ?? "").trim();
  if (!raw) return null;

  const letter = raw.toUpperCase().replace(/[).\s]/g, "");
  const li = LETTERS.indexOf(letter);
  if (li >= 0) return li;

  const num = Number(raw);
  if (Number.isInteger(num) && num >= 1) return num - 1;

  const opts: string[] =
    session.pendingKind === "question"
      ? ((session.pendingMeta?.options as string[]) ?? [])
      : ((session.pendingMeta?.sets as Array<{ title: string }>) ?? []).map((s) => s.title);
  const hit = opts.findIndex((o) => o.trim().toLowerCase() === raw.toLowerCase());
  return hit >= 0 ? hit : null;
}

async function advance(session: Session, channel: Channel, peerId: string, choiceIndex: number) {
  if (session.stage === "choosing_set") {
    const sets = (session.pendingMeta?.sets as Array<{ id: string; title: string }>) ?? [];
    const picked = sets[choiceIndex];
    if (!picked) {
      await sendPlain(channel, peerId, "That option isn't on the list — reply with the letter of a set.");
      return;
    }
    const items = await query<{ id: string }>(
      `SELECT id FROM question_set_items
        WHERE set_id = $1 AND id NOT IN (SELECT item_id FROM chat_quiz_seen WHERE thread_id = $2)
        ORDER BY position`,
      [picked.id, session.threadId],
    );
    if (!items.length) {
      await saveSession(session.id, { stage: "done", pendingKind: null, pendingRef: null, finished: true });
      await sendPlain(channel, peerId, "You've already answered every question in that set. Send \"test\" to pick another.");
      return;
    }
    const questionIds = items.map((i) => i.id);
    await saveSession(session.id, {
      setId: picked.id,
      stage: "in_progress",
      questionIds,
      currentIndex: 0,
      correct: 0,
      answers: [],
    });
    await sendPlain(channel, peerId, `Starting "${picked.title}" — ${questionIds.length} question${questionIds.length === 1 ? "" : "s"}.`);
    await askQuestion(
      { ...session, setId: picked.id, stage: "in_progress", questionIds, currentIndex: 0, correct: 0, answers: [] },
      channel,
      peerId,
    );
    return;
  }

  // in_progress -> grade current question
  const meta = session.pendingMeta ?? {};
  const correctIndex = Number(meta.correctIndex ?? -1);
  const options = (meta.options as string[]) ?? [];
  if (choiceIndex >= options.length) {
    await sendPlain(channel, peerId, "That option isn't on the list — reply with A, B, C or D.");
    return;
  }
  const isCorrect = choiceIndex === correctIndex;
  const answers = [...session.answers, { itemId: String(meta.itemId), chosen: choiceIndex, correct: isCorrect }];
  const correct = session.correct + (isCorrect ? 1 : 0);
  const nextIndex = session.currentIndex + 1;
  await saveSession(session.id, { answers, correct, currentIndex: nextIndex, pendingKind: null, pendingRef: null });

  const explanation = await one<{ explanation: string }>(
    `SELECT explanation FROM question_set_items WHERE id = $1`,
    [String(meta.itemId)],
  );
  const feedback = isCorrect
    ? `✅ Correct.${explanation?.explanation ? ` ${explanation.explanation}` : ""}`
    : `❌ Not quite — the answer was ${LETTERS[correctIndex] ?? "?"}.${explanation?.explanation ? ` ${explanation.explanation}` : ""}`;
  await sendPlain(channel, peerId, feedback);

  const updated: Session = { ...session, answers, correct, currentIndex: nextIndex, pendingKind: null, pendingRef: null };
  if (nextIndex >= session.questionIds.length) await finishQuiz(updated, channel, peerId);
  else await askQuestion(updated, channel, peerId);
}

// --- public entry points ------------------------------------------------

/**
 * Called for every inbound text before the AI assistant. Returns true when the
 * quiz flow consumed the message (so no AI reply should be sent).
 */
export async function maybeHandleQuiz(
  threadId: string,
  text: string,
  channel: Channel,
  peerId: string,
  userId: string | null,
): Promise<boolean> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return false;

  const session = await getActiveQuizSession(threadId);

  if (session) {
    if (/^(stop|cancel|quit|exit)$/i.test(trimmed)) {
      await saveSession(session.id, { stage: "abandoned", pendingKind: null, pendingRef: null });
      await sendPlain(channel, peerId, "Test cancelled. Send \"test\" any time to start again.");
      return true;
    }
    const idx = resolveChoiceIndex(session, { text: trimmed });
    if (idx === null) {
      // Not a recognisable answer — nudge, but only if they clearly meant to answer.
      await sendPlain(channel, peerId, session.stage === "choosing_set"
        ? "Reply with the letter of the set you want (A, B, C…), or \"stop\" to cancel."
        : "Reply with A, B, C or D, or \"stop\" to cancel.");
      return true;
    }
    await advance(session, channel, peerId, idx);
    return true;
  }

  if (START_INTENT.test(trimmed) && trimmed.length <= 40) {
    return startQuiz(threadId, channel, peerId, userId);
  }
  return false;
}

/** WhatsApp interactive reply (list_reply / button_reply id like "qset:2"). */
export async function handleQuizInteractive(
  threadId: string,
  channel: Channel,
  peerId: string,
  replyId: string,
): Promise<boolean> {
  const m = /^(qset|qopt):(\d+)$/.exec(replyId.trim());
  if (!m) return false;
  const session = await getActiveQuizSession(threadId);
  if (!session) return false;
  await advance(session, channel, peerId, Number(m[2]));
  return true;
}

/** Telegram bot poll_answer: correlate by poll id, advance with the chosen index. */
export async function handleQuizPollAnswer(pollId: string, optionIndex: number): Promise<boolean> {
  const session = await getSessionByPendingRef(pollId);
  if (!session) return false;
  const t = await one<{ peerId: string; channel: string }>(
    `SELECT peer_id AS "peerId", channel FROM chat_threads WHERE id = $1`,
    [session.threadId],
  );
  if (!t) return false;
  await advance(session, t.channel as Channel, t.peerId, optionIndex);
  return true;
}
