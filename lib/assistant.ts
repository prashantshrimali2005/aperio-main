import "server-only";

import { one, query } from "@/lib/db";
import { primaryOrigin } from "@/lib/origin";
import { getIntegrationRuntime } from "@/lib/settings";

const APP_URL = primaryOrigin("https://aperio-umber.vercel.app");

interface AssistantConfig {
  enabled: boolean;
  linkedOnly: boolean;
}

/** Global auto-reply config. Default: on, but only for threads tied to an Aperio user. */
export async function getAssistantConfig(): Promise<AssistantConfig> {
  try {
    const rt = await getIntegrationRuntime("assistant");
    return {
      enabled: rt.config.enabled === undefined ? true : String(rt.config.enabled) !== "false",
      linkedOnly: String(rt.config.linkedOnly ?? "true") !== "false",
    };
  } catch {
    return { enabled: true, linkedOnly: true };
  }
}

/** Compact, factual snapshot of what Aperio knows about a user, for the assistant prompt. */
export async function buildUserContext(userId: string): Promise<string> {
  const u = await one<Record<string, unknown>>(
    `SELECT u.full_name AS "name",
       p.headline, p.current_status AS "status", r.title AS "targetRole", p.target_level AS "targetLevel"
     FROM users u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN roles r ON r.id=p.target_role_id
     WHERE u.id=$1`,
    [userId],
  );
  if (!u) return "No Aperio profile found for this person.";

  const lines: string[] = [`Name: ${u.name}`];
  if (u.targetRole) lines.push(`Target role: ${u.targetRole} (${u.targetLevel ?? "mid"})`);
  if (u.headline) lines.push(`Headline: ${u.headline}`);

  const analysis = await one<Record<string, unknown>>(
    `SELECT a.id, ro.title AS "role", a.experience_level AS "level", a.overall_score AS "overall",
       a.technical_score AS "technical", a.soft_score AS "soft",
       a.matched_count AS "matched", a.developing_count AS "developing", a.missing_count AS "missing",
       a.created_at AS "at"
     FROM analyses a JOIN roles ro ON ro.id=a.role_id
     WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 1`,
    [userId],
  );
  if (analysis) {
    lines.push(
      `Latest analysis (${new Date(String(analysis.at)).toISOString().slice(0, 10)}): ${analysis.role} ${analysis.level} — overall ${analysis.overall}/100, technical ${analysis.technical ?? "—"}, professional ${analysis.soft ?? "—"}. ${analysis.matched} matched, ${analysis.developing} developing, ${analysis.missing} not demonstrated.`,
    );
    const gaps = await query<{ name: string; current: number; target: number; importance: string }>(
      `SELECT s.name, ar.current_level AS current, ar.target_level AS target, ar.importance
       FROM analysis_skill_results ar JOIN skills s ON s.id=ar.skill_id
       WHERE ar.analysis_id=$1 AND ar.classification <> 'strong'
       ORDER BY CASE ar.importance WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, s.name LIMIT 6`,
      [analysis.id],
    );
    if (gaps.length) lines.push(`Top gaps: ${gaps.map((g) => `${g.name} (${g.current}->${g.target})`).join(", ")}`);
  } else {
    lines.push("Has not run an analysis yet.");
  }

  const roadmap = await one<Record<string, unknown>>(
    `SELECT
       (SELECT count(*) FROM roadmap_items ri WHERE ri.roadmap_id=rm.id) AS total,
       (SELECT count(*) FROM roadmap_items ri WHERE ri.roadmap_id=rm.id AND ri.status='completed') AS done,
       (SELECT s.name FROM roadmap_items ri JOIN skills s ON s.id=ri.skill_id
        WHERE ri.roadmap_id=rm.id AND ri.status <> 'completed' ORDER BY ri.position LIMIT 1) AS "nextSkill"
     FROM roadmaps rm WHERE rm.user_id=$1 ORDER BY rm.created_at DESC LIMIT 1`,
    [userId],
  );
  if (roadmap && Number(roadmap.total) > 0) {
    lines.push(`Roadmap: ${roadmap.done}/${roadmap.total} steps done${roadmap.nextSkill ? `, next up ${roadmap.nextSkill}` : ""}.`);
  }

  const course = await one<Record<string, unknown>>(
    `SELECT lp.title, lp.total_weeks AS "weeks",
       (SELECT count(*) FROM learning_path_modules m WHERE m.path_id=lp.id) AS modules,
       (SELECT count(*) FROM learning_path_modules m WHERE m.path_id=lp.id AND m.status='completed') AS done
     FROM learning_paths lp WHERE lp.user_id=$1 AND lp.status='active' ORDER BY lp.created_at DESC LIMIT 1`,
    [userId],
  );
  if (course) lines.push(`Active course plan: "${course.title}" — ${course.done}/${course.modules} modules, ${course.weeks} weeks.`);

  const jobs = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM job_postings j
     WHERE j.skill_ids && ARRAY(
       SELECT ar.skill_id FROM analysis_skill_results ar JOIN analyses a ON a.id=ar.analysis_id AND a.user_id=$1
       WHERE ar.classification <> 'missing' AND a.created_at=(SELECT max(created_at) FROM analyses WHERE user_id=$1)
     )`,
    [userId],
  );
  if (jobs && jobs.n > 0) lines.push(`${jobs.n} job openings currently match their skills (on the Jobs page).`);

  lines.push(`App sections: /overview, /analyze, /skills, /roadmap, /learning (course plan), /practice, /jobs, /history. Base URL: ${APP_URL}`);
  return lines.join("\n");
}

/**
 * If auto-reply is on and this thread qualifies, generate a Gemini reply from
 * system + user context and send it back on the same channel.
 */
export async function maybeAutoReply(threadId: string, incomingText: string | null) {
  try {
    await runAutoReply(threadId, incomingText);
  } catch (error) {
    // Never let this reject unhandled — it's always called fire-and-forget.
    console.error("assistant auto-reply failed", error instanceof Error ? error.message : error);
  }
}

async function runAutoReply(threadId: string, incomingText: string | null) {
  const text = (incomingText ?? "").trim();
  if (text.length < 2) return;

  const cfg = await getAssistantConfig();
  if (!cfg.enabled) return;

  const thread = await one<{ channel: string; userId: string | null; autoReply: boolean | null } & Record<string, unknown>>(
    `SELECT channel, user_id AS "userId", auto_reply AS "autoReply" FROM chat_threads WHERE id=$1`,
    [threadId],
  );
  if (!thread) return;
  if (thread.autoReply === false) return;
  if (thread.autoReply === null && cfg.linkedOnly && !thread.userId) return;

  const gemini = await import("@/lib/gemini");
  if (!gemini.isGeminiConfigured()) return;

  let userContext: string;
  try {
    userContext = thread.userId
      ? await buildUserContext(thread.userId)
      : "This person is not a signed-up Aperio user. Encourage them warmly to sign up at Aperio to get an evidence-based analysis.";
  } catch (error) {
    console.error("assistant: buildUserContext failed", error instanceof Error ? error.message : error);
    userContext = thread.userId
      ? "The user's Aperio profile could not be loaded right now. Keep the reply general and suggest they open the app."
      : "This person is not a signed-up Aperio user. Encourage them to sign up at Aperio.";
  }

  const history = await query<{ direction: string; text: string | null }>(
    `SELECT direction, text FROM chat_messages
     WHERE thread_id=$1 AND text IS NOT NULL AND text <> '' AND kind IN ('text')
     ORDER BY created_at DESC LIMIT 12`,
    [threadId],
  );
  const turns = history
    .reverse()
    .map((m) => ({ role: (m.direction === "out" ? "model" : "user") as "user" | "model", text: String(m.text) }));
  // Drop the just-recorded inbound message if it's the last turn — it's passed
  // separately as `message`.
  if (turns.length && turns[turns.length - 1].role === "user" && turns[turns.length - 1].text.trim() === text) {
    turns.pop();
  }

  let reply: string;
  try {
    reply = await gemini.assistantReply({
      channel: thread.channel.replace("_userbot", "").replace("_bot", ""),
      userContext,
      history: turns.slice(-10),
      message: text,
    });
  } catch (error) {
    console.error("assistant reply generation failed", error instanceof Error ? error.message : error);
    return;
  }
  if (!reply || reply.length < 2) {
    console.error("assistant reply generation returned empty");
    return;
  }

  const { sendChatMessage } = await import("@/lib/chat-send");
  try {
    await sendChatMessage(threadId, { text: reply });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "send failed";
    console.error("assistant reply send failed", detail);
    // Leave a visible trace in the workspace so a dead Telegram session or an
    // expired WhatsApp window is obvious instead of silent.
    const { recordMessage } = await import("@/lib/chat");
    await recordMessage({
      threadId,
      direction: "out",
      kind: "system",
      text: `⚠️ Auto-reply generated but not delivered: ${detail}`,
      senderName: "Aperio",
      status: "failed",
    }).catch(() => {});
  }
}
