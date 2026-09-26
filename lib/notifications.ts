import "server-only";

import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/telegram";

export type NotificationKind = "roadmap" | "weekly_digest" | "analysis" | "inactivity" | "link_confirm";

const PREF_COLUMN: Partial<Record<NotificationKind, string>> = {
  roadmap: "notify_roadmap",
  weekly_digest: "notify_weekly_digest",
  analysis: "notify_analysis",
  inactivity: "notify_inactivity",
};

interface LinkedChannel {
  id: string;
  platform: "telegram" | "whatsapp" | "email";
  address: string;
  via?: string | null;
  peerAccessHash?: string | null;
}

export function newLinkCode() {
  // Unambiguous alphabet (no 0/O/1/I), 8 chars.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

async function linkedChannels(userId: string): Promise<LinkedChannel[]> {
  const channels = await query<LinkedChannel & Record<string, unknown>>(
    `SELECT id, platform, address, via, peer_access_hash AS "peerAccessHash" FROM messaging_channels
     WHERE user_id=$1 AND status='linked' AND address IS NOT NULL`,
    [userId],
  );
  // Email is not "linked" with a code — it goes to the account's own address
  // when email notifications are on for the user and an email provider is set up.
  const emailRow = await query<{ email: string; on: boolean } & Record<string, unknown>>(
    `SELECT u.email, COALESCE(p.notify_email, true) AS "on"
     FROM users u LEFT JOIN preferences p ON p.user_id = u.id WHERE u.id=$1`,
    [userId],
  );
  if (emailRow[0]?.on && emailRow[0].email) {
    const { isEmailConfigured } = await import("@/lib/email");
    if (await isEmailConfigured()) channels.push({ id: "email", platform: "email", address: emailRow[0].email });
  }
  return channels;
}

interface EmailContent {
  subject: string;
  html: string;
  text?: string;
}

async function deliver(channel: LinkedChannel, text: string, email?: EmailContent) {
  if (channel.platform === "telegram") {
    if (channel.via === "userbot") {
      const { sendUserbotDirect } = await import("@/lib/telegram-userbot");
      await sendUserbotDirect(channel.address, channel.peerAccessHash ?? null, text.replace(/<\/?b>/g, ""));
      return;
    }
    if (!(await getTelegramConfig()).configured) throw new Error("TELEGRAM_NOT_CONFIGURED");
    await sendTelegramMessage(channel.address, text);
    return;
  }
  if (channel.platform === "whatsapp") {
    const { getWhatsAppConfig, sendWhatsAppText } = await import("@/lib/whatsapp");
    if (!(await getWhatsAppConfig()).configured) throw new Error("WHATSAPP_NOT_CONFIGURED");
    await sendWhatsAppText(channel.address, text);
    return;
  }
  if (channel.platform === "email") {
    const { sendEmail, notificationEmail } = await import("@/lib/email");
    const content = email ?? notificationEmail(text);
    await sendEmail(channel.address, content.subject, content.html, content.text ?? text.replace(/<\/?b>/g, ""));
    return;
  }
  throw new Error("UNKNOWN_CHANNEL");
}

/**
 * Send `text` to every linked channel for the user, once per `dedupeKey`.
 * Returns what happened so callers/cron can report counts.
 */
export async function dispatch(input: {
  userId: string;
  kind: NotificationKind;
  dedupeKey: string;
  text: string;
  email?: EmailContent;
}): Promise<"sent" | "skipped" | "failed" | "no_channel"> {
  const claim = await query<{ id: string }>(
    `INSERT INTO notification_log (id, user_id, kind, dedupe_key, status)
     VALUES ($1,$2,$3,$4,'skipped')
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [randomUUID(), input.userId, input.kind, input.dedupeKey],
  );
  if (!claim[0]) return "skipped";
  const logId = claim[0].id;

  const channels = await linkedChannels(input.userId);
  if (!channels.length) {
    await query("UPDATE notification_log SET status='skipped', detail='no linked channel' WHERE id=$1", [logId]);
    return "no_channel";
  }

  let anySent = false;
  const errors: string[] = [];
  for (const channel of channels) {
    try {
      await deliver(channel, input.text, input.email);
      anySent = true;
    } catch (error) {
      errors.push(`${channel.platform}: ${error instanceof Error ? error.message : "error"}`);
    }
  }

  const status = anySent ? "sent" : "failed";
  await query("UPDATE notification_log SET status=$1, channel_id=$2, detail=$3 WHERE id=$4", [
    status,
    channels[0].id,
    errors.join("; ") || null,
    logId,
  ]);
  return status;
}

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// --- Event-driven ------------------------------------------------------------

export async function notifyAnalysisReady(userId: string, analysisId: string) {
  const row = await query<{
    firstName: string; roleTitle: string; overallScore: number; technicalScore: number | null; softScore: number | null;
    matchedCount: number; developingCount: number; missingCount: number;
  } & Record<string, unknown>>(
    `SELECT split_part(u.full_name,' ',1) AS "firstName", r.title AS "roleTitle",
       a.overall_score AS "overallScore", a.technical_score AS "technicalScore", a.soft_score AS "softScore",
       a.matched_count AS "matchedCount", a.developing_count AS "developingCount", a.missing_count AS "missingCount"
     FROM analyses a JOIN roles r ON r.id=a.role_id JOIN users u ON u.id=a.user_id
     WHERE a.id=$1 AND a.user_id=$2`,
    [analysisId, userId],
  );
  const analysis = row[0];
  if (!analysis) return;
  if (!(await prefEnabled(userId, "analysis"))) return;

  const gaps = await query<{ name: string }>(
    `SELECT s.name FROM analysis_skill_results ar JOIN skills s ON s.id=ar.skill_id
     WHERE ar.analysis_id=$1 AND ar.classification <> 'strong'
     ORDER BY CASE ar.importance WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 4`,
    [analysisId],
  );
  const topGaps = gaps.map((g) => g.name);

  const text =
    `<b>Aperio — analysis ready</b>\n` +
    `${analysis.roleTitle}: ${analysis.overallScore}/100 (technical ${analysis.technicalScore ?? "—"}, professional ${analysis.softScore ?? "—"}).\n` +
    `${analysis.missingCount} gap(s) to close${topGaps.length ? `: ${topGaps.join(", ")}` : ""}.\nOpen your report and plan in Aperio.`;

  const { buildNotificationEmail } = await import("@/lib/email");
  const email = buildNotificationEmail("analysis", {
    firstName: analysis.firstName || undefined,
    roleTitle: analysis.roleTitle,
    overall: analysis.overallScore,
    technical: analysis.technicalScore,
    soft: analysis.softScore,
    matched: analysis.matchedCount,
    developing: analysis.developingCount,
    missing: analysis.missingCount,
    topGaps,
  });
  await dispatch({ userId, kind: "analysis", dedupeKey: `analysis:${analysisId}`, text, email });
}

async function prefEnabled(userId: string, kind: NotificationKind) {
  const column = PREF_COLUMN[kind];
  if (!column) return true;
  const rows = await query<Record<string, unknown>>(
    `SELECT ${column} AS enabled FROM preferences WHERE user_id=$1`,
    [userId],
  );
  return rows[0] ? Boolean(rows[0].enabled) : false;
}

// --- Scheduled batches ------------------------------------------------------

export async function runRoadmapReminders() {
  const rows = await query<{ userId: string; firstName: string; pending: number; nextSkill: string; nextAction: string } & Record<string, unknown>>(
    `SELECT rm.user_id AS "userId", split_part(u.full_name,' ',1) AS "firstName",
       COUNT(*) FILTER (WHERE ri.status <> 'completed') AS pending,
       (ARRAY_AGG(s.name ORDER BY ri.position) FILTER (WHERE ri.status <> 'completed'))[1] AS "nextSkill",
       (ARRAY_AGG(ri.recommended_action ORDER BY ri.position) FILTER (WHERE ri.status <> 'completed'))[1] AS "nextAction"
     FROM roadmaps rm
     JOIN roadmap_items ri ON ri.roadmap_id = rm.id
     JOIN skills s ON s.id = ri.skill_id
     JOIN users u ON u.id = rm.user_id
     JOIN preferences p ON p.user_id = rm.user_id AND p.notify_roadmap = true
     JOIN messaging_channels mc ON mc.user_id = rm.user_id AND mc.status = 'linked'
     WHERE rm.created_at = (SELECT MAX(created_at) FROM roadmaps WHERE user_id = rm.user_id)
     GROUP BY rm.user_id, u.full_name
     HAVING COUNT(*) FILTER (WHERE ri.status <> 'completed') > 0`,
  );
  const { buildNotificationEmail } = await import("@/lib/email");
  const day = new Date().toISOString().slice(0, 10);
  let sent = 0;
  for (const row of rows) {
    const text =
      `<b>Aperio — keep your roadmap moving</b>\n` +
      `${row.pending} step(s) still open. Next up: <b>${row.nextSkill}</b>.\n${row.nextAction}`;
    const email = buildNotificationEmail("roadmap", {
      firstName: row.firstName || undefined,
      pending: Number(row.pending),
      nextSkill: row.nextSkill,
      nextAction: row.nextAction,
    });
    const result = await dispatch({ userId: row.userId, kind: "roadmap", dedupeKey: `roadmap:${row.userId}:${day}`, text, email });
    if (result === "sent") sent += 1;
  }
  return { candidates: rows.length, sent };
}

export async function runWeeklyDigest() {
  const rows = await query<{
    userId: string; firstName: string; roleTitle: string | null; overallScore: number | null;
    completed: number; pending: number;
  } & Record<string, unknown>>(
    `SELECT u.id AS "userId", split_part(u.full_name,' ',1) AS "firstName",
       latest_role.title AS "roleTitle",
       latest.overall_score AS "overallScore",
       COALESCE(rp.completed, 0) AS completed,
       COALESCE(rp.pending, 0) AS pending
     FROM users u
     JOIN preferences p ON p.user_id = u.id AND p.notify_weekly_digest = true
     JOIN messaging_channels mc ON mc.user_id = u.id AND mc.status = 'linked'
     LEFT JOIN LATERAL (
       SELECT id, role_id, overall_score FROM analyses WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
     ) latest ON true
     LEFT JOIN roles latest_role ON latest_role.id = latest.role_id
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE ri.status = 'completed') AS completed,
         COUNT(*) FILTER (WHERE ri.status <> 'completed') AS pending
       FROM roadmaps rm JOIN roadmap_items ri ON ri.roadmap_id = rm.id
       WHERE rm.user_id = u.id
         AND rm.created_at = (SELECT MAX(created_at) FROM roadmaps WHERE user_id = u.id)
     ) rp ON true`,
  );
  const { buildNotificationEmail } = await import("@/lib/email");
  const week = isoWeek();
  let sent = 0;
  for (const row of rows) {
    const head = row.roleTitle
      ? `${row.roleTitle}: match ${row.overallScore ?? "—"}/100`
      : `No analysis yet — run one to start tracking.`;
    const text =
      `<b>Aperio — your week</b>\n${head}\n` +
      `Roadmap: ${row.completed} done, ${row.pending} open.\n` +
      `Pick one step to finish this week.`;
    const email = buildNotificationEmail("weekly_digest", {
      firstName: row.firstName || undefined,
      roleTitle: row.roleTitle,
      overall: row.overallScore,
      completed: Number(row.completed),
      pending: Number(row.pending),
    });
    const result = await dispatch({ userId: row.userId, kind: "weekly_digest", dedupeKey: `weekly_digest:${row.userId}:${week}`, text, email });
    if (result === "sent") sent += 1;
  }
  return { candidates: rows.length, sent };
}

export async function runInactivityNudges(idleDays = 7) {
  const rows = await query<{ userId: string; firstName: string } & Record<string, unknown>>(
    `SELECT u.id AS "userId", split_part(u.full_name,' ',1) AS "firstName"
     FROM users u
     JOIN preferences p ON p.user_id = u.id AND p.notify_inactivity = true
     JOIN messaging_channels mc ON mc.user_id = u.id AND mc.status = 'linked'
     WHERE NOT EXISTS (SELECT 1 FROM analyses a WHERE a.user_id = u.id AND a.created_at > now() - ($1 || ' days')::interval)
       AND NOT EXISTS (
         SELECT 1 FROM roadmaps rm JOIN roadmap_items ri ON ri.roadmap_id = rm.id
         WHERE rm.user_id = u.id AND ri.updated_at > now() - ($1 || ' days')::interval
       )
       AND EXISTS (SELECT 1 FROM roadmaps rm WHERE rm.user_id = u.id)`,
    [String(idleDays)],
  );
  const window = `${new Date().getUTCFullYear()}-${Math.floor(Date.now() / (idleDays * 86_400_000))}`;
  let sent = 0;
  const { buildNotificationEmail } = await import("@/lib/email");
  for (const row of rows) {
    const text =
      `<b>Aperio — pick your progress back up</b>\n` +
      `It's been a quiet week. Ten focused minutes on your top roadmap step keeps the momentum going.`;
    const email = buildNotificationEmail("inactivity", { firstName: row.firstName || undefined });
    const result = await dispatch({ userId: row.userId, kind: "inactivity", dedupeKey: `inactivity:${row.userId}:${window}`, text, email });
    if (result === "sent") sent += 1;
  }
  return { candidates: rows.length, sent };
}
