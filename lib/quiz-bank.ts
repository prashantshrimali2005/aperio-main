import "server-only";

import { randomUUID } from "node:crypto";
import { db, one, query } from "@/lib/db";

export interface QuestionSetRow {
  id: string;
  title: string;
  niche: string;
  topic: string;
  level: "junior" | "mid" | "senior" | "all";
  description: string;
  questionCount: number;
  published: boolean;
  createdAt: string;
}

export interface QuestionItem {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  position: number;
}

async function resolveSkillId(topic: string, niche: string): Promise<string | null> {
  const row = await one<{ id: string }>(
    `SELECT id FROM skills
      WHERE lower(name) = lower($1) OR lower(name) = lower($2)
      ORDER BY (lower(name) = lower($1)) DESC LIMIT 1`,
    [topic, niche],
  );
  return row?.id ?? null;
}

const normText = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

/** Suggest a fresh practice-set topic for the admin, avoiding what exists. */
export async function suggestQuestionSetTopics(niche?: string) {
  const gemini = await import("@/lib/gemini");
  if (!gemini.isGeminiConfigured()) throw new Error("GEMINI_NOT_CONFIGURED");
  const existing = await query<{ topic: string; niche: string }>(`SELECT topic, niche FROM question_sets ORDER BY created_at DESC LIMIT 80`);
  return gemini.suggestQuestionSetTopics({
    niche,
    existing: existing.map((r) => `${r.niche} — ${r.topic}`),
  });
}

/** Generate one question set with Gemini and store it. */
export async function generateQuestionSet(
  input: { topic: string; niche?: string; level?: QuestionSetRow["level"]; count?: number; priceInr?: number },
  editor: string,
) {
  const gemini = await import("@/lib/gemini");
  if (!gemini.isGeminiConfigured()) throw new Error("GEMINI_NOT_CONFIGURED");

  const niche = (input.niche || "General").trim().slice(0, 60) || "General";
  const level = input.level ?? "mid";

  const existing = await query<{ topic: string; niche: string; title: string }>(`SELECT topic, niche, title FROM question_sets`);
  const key = `${normText(niche)}|${normText(input.topic)}`;
  if (existing.some((r) => `${normText(r.niche)}|${normText(r.topic)}` === key)) throw new Error("DUPLICATE_SET");

  const generated = await gemini.generateQuestionSet({
    topic: input.topic,
    niche,
    level,
    count: input.count,
    avoidTopics: existing.filter((r) => normText(r.niche) === normText(niche)).map((r) => r.topic),
  });
  if (existing.some((r) => normText(r.title) === normText(generated.title))) throw new Error("DUPLICATE_SET");
  const skillId = await resolveSkillId(input.topic, niche);

  const id = randomUUID();
  const items = generated.questions.map((q, position) => ({
    id: randomUUID(),
    prompt: q.prompt.slice(0, 600),
    options: q.options.map((o) => String(o).slice(0, 240)),
    correctIndex: q.correctIndex,
    explanation: q.explanation.slice(0, 600),
    position,
  }));

  const priceInr = Math.max(0, Math.min(100000, Math.round(Number(input.priceInr ?? 0) || 0)));

  const sql = db();
  await sql.transaction((tx) => [
    tx`INSERT INTO question_sets (id, title, niche, topic, level, skill_id, description, question_count, price_inr, generator, created_by)
       VALUES (${id}, ${generated.title.slice(0, 140)}, ${niche}, ${input.topic.slice(0, 200)}, ${level}, ${skillId},
         ${generated.description.slice(0, 500)}, ${items.length}, ${priceInr}, 'gemini', ${editor})`,
    ...items.map(
      (it) => tx`INSERT INTO question_set_items (id, set_id, prompt, options, correct_index, explanation, position)
        VALUES (${it.id}, ${id}, ${it.prompt}, ${JSON.stringify(it.options)}::jsonb, ${it.correctIndex}, ${it.explanation}, ${it.position})`,
    ),
  ]);
  return getQuestionSet(id);
}

export async function listQuestionSets() {
  return query<Record<string, unknown>>(
    `SELECT s.id, s.title, s.niche, s.topic, s.level, s.description, s.question_count AS "questionCount",
       s.published, s.price_inr AS "priceInr", s.created_at AS "createdAt",
       (SELECT count(*) FROM question_set_attempts a WHERE a.set_id = s.id) AS attempts
     FROM question_sets s
     ORDER BY s.niche, s.created_at DESC`,
  );
}

export async function setQuestionSetPrice(id: string, priceInr: number) {
  const p = Math.max(0, Math.min(100000, Math.round(Number(priceInr) || 0)));
  await query(`UPDATE question_sets SET price_inr=$2, updated_at=now() WHERE id=$1`, [id, p]);
}

export async function getQuestionSet(id: string) {
  const set = await one<QuestionSetRow & Record<string, unknown>>(
    `SELECT id, title, niche, topic, level, description, question_count AS "questionCount", published, price_inr AS "priceInr", created_at AS "createdAt"
     FROM question_sets WHERE id=$1`,
    [id],
  );
  if (!set) return null;
  const items = await query<QuestionItem & Record<string, unknown>>(
    `SELECT id, prompt, options, correct_index AS "correctIndex", explanation, position
     FROM question_set_items WHERE set_id=$1 ORDER BY position`,
    [id],
  );
  return { ...set, questions: items };
}

export async function setQuestionSetPublished(id: string, published: boolean) {
  await query(`UPDATE question_sets SET published=$2, updated_at=now() WHERE id=$1`, [id, published]);
}

export async function deleteQuestionSet(id: string) {
  await query(`DELETE FROM question_sets WHERE id=$1`, [id]);
}

// --- user side -------------------------------------------------------------

/** Published sets grouped for the practice page, with this user's best score. */
export async function listQuestionSetsForUser(userId: string) {
  return query<Record<string, unknown>>(
    `SELECT s.id, s.title, s.niche, s.topic, s.level, s.description, s.question_count AS "questionCount",
       s.price_inr AS "priceInr",
       (s.price_inr <= 0 OR EXISTS (SELECT 1 FROM payments p WHERE p.user_id=$1 AND p.item_type='question_set' AND p.item_id=s.id AND p.status='paid')) AS "owned",
       (SELECT max(a.score) FROM question_set_attempts a WHERE a.set_id=s.id AND a.user_id=$1) AS "bestScore",
       (SELECT count(*) FROM question_set_attempts a WHERE a.set_id=s.id AND a.user_id=$1) AS "attempts"
     FROM question_sets s
     WHERE s.published = true AND s.question_count > 0
     ORDER BY s.niche, s.created_at DESC`,
    [userId],
  );
}

/** Set for a learner to take — questions and options only, no answers. */
export async function getQuestionSetForUser(userId: string, id: string) {
  const set = await one<Record<string, unknown>>(
    `SELECT id, title, niche, topic, level, description, question_count AS "questionCount", price_inr AS "priceInr"
     FROM question_sets WHERE id=$1 AND published=true`,
    [id],
  );
  if (!set) return null;
  if (Number(set.priceInr) > 0) {
    const { hasEntitlement } = await import("@/lib/payments");
    if (!(await hasEntitlement(userId, "question_set", id))) return { ...set, locked: true, questions: [] };
  }
  const items = await query<Record<string, unknown>>(
    `SELECT id, prompt, options, position FROM question_set_items WHERE set_id=$1 ORDER BY position`,
    [id],
  );
  return { ...set, questions: items };
}

/** Grade an attempt and store it. `answers` maps question id -> chosen index. */
export async function submitQuestionSetAttempt(userId: string, setId: string, answers: Array<{ questionId: string; answerIndex: number }>) {
  const meta = await one<{ priceInr: number }>(`SELECT price_inr AS "priceInr" FROM question_sets WHERE id=$1 AND published=true`, [setId]);
  if (!meta) throw new Error("SET_NOT_FOUND");
  if (Number(meta.priceInr) > 0) {
    const { hasEntitlement } = await import("@/lib/payments");
    if (!(await hasEntitlement(userId, "question_set", setId))) throw new Error("PAYMENT_REQUIRED");
  }
  const items = await query<{ id: string; correctIndex: number; explanation: string; options: string[]; prompt: string; position: number }>(
    `SELECT id, correct_index AS "correctIndex", explanation, options, prompt, position
     FROM question_set_items WHERE set_id=$1 ORDER BY position`,
    [setId],
  );
  if (!items.length) throw new Error("SET_NOT_FOUND");

  const chosen = new Map(answers.map((a) => [a.questionId, a.answerIndex]));
  const review = items.map((it) => {
    const picked = chosen.has(it.id) ? Number(chosen.get(it.id)) : -1;
    return {
      questionId: it.id,
      prompt: it.prompt,
      options: it.options,
      picked,
      correctIndex: it.correctIndex,
      correct: picked === it.correctIndex,
      explanation: it.explanation,
    };
  });
  const correct = review.filter((r) => r.correct).length;
  const total = items.length;
  const score = Math.round((correct / total) * 100);

  await query(
    `INSERT INTO question_set_attempts (id, user_id, set_id, score, correct, total, answers)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [randomUUID(), userId, setId, score, correct, total, JSON.stringify(answers.map((a) => ({ q: a.questionId, a: a.answerIndex })))],
  );

  return { score, correct, total, review };
}
