import { one, query } from "@/lib/db";

export async function getAdminOverview() {
  const totals = await one<Record<string, number>>(
    `SELECT
      (SELECT count(*) FROM users) AS users,
      (SELECT count(*) FROM users WHERE role='admin') AS admins,
      (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days') AS "newUsers7d",
      (SELECT count(*) FROM users WHERE last_seen_at > now() - interval '7 days') AS "active7d",
      (SELECT count(*) FROM analyses) AS analyses,
      (SELECT count(*) FROM analyses WHERE created_at > now() - interval '7 days') AS "analyses7d",
      (SELECT count(*) FROM resumes) AS resumes,
      (SELECT count(*) FROM learning_paths) AS "learningPaths",
      (SELECT count(*) FROM messaging_channels WHERE status='linked') AS "linkedChannels",
      (SELECT count(*) FROM notification_log WHERE status='sent') AS "notificationsSent",
      (SELECT count(*) FROM activity_events WHERE created_at > now() - interval '24 hours') AS "events24h"`,
  );

  const daily = await query<Record<string, unknown>>(
    `SELECT to_char(d::date,'Mon DD') AS label,
       (SELECT count(*) FROM users u WHERE u.created_at::date = d::date) AS signups,
       (SELECT count(*) FROM analyses a WHERE a.created_at::date = d::date) AS analyses,
       (SELECT count(*) FROM activity_events e WHERE e.created_at::date = d::date) AS events
     FROM generate_series(now()::date - interval '13 days', now()::date, interval '1 day') d
     ORDER BY d`,
  );

  const topActions = await query<Record<string, unknown>>(
    `SELECT action, count(*)::int AS count FROM activity_events
     WHERE created_at > now() - interval '7 days'
     GROUP BY action ORDER BY count DESC LIMIT 12`,
  );

  const recentUsers = await query<Record<string, unknown>>(
    `SELECT u.id, u.full_name AS "fullName", u.email, u.role, u.created_at AS "createdAt",
       u.last_seen_at AS "lastSeenAt",
       (SELECT count(*) FROM analyses a WHERE a.user_id=u.id) AS analyses
     FROM users u ORDER BY u.created_at DESC LIMIT 8`,
  );

  const recentActivity = await getActivityFeed({ limit: 15 });

  return { totals, daily, topActions, recentUsers, recentActivity };
}

export async function getUserList(input: { q?: string; limit?: number; offset?: number }) {
  const limit = Math.min(100, Math.max(1, input.limit ?? 30));
  const offset = Math.max(0, input.offset ?? 0);
  const like = input.q ? `%${input.q.toLowerCase()}%` : null;
  const rows = await query<Record<string, unknown>>(
    `SELECT u.id, u.full_name AS "fullName", u.email, u.role, u.auth_provider AS "authProvider",
       u.created_at AS "createdAt", u.last_seen_at AS "lastSeenAt",
       (SELECT count(*) FROM analyses a WHERE a.user_id=u.id) AS analyses,
       (SELECT count(*) FROM resumes r WHERE r.user_id=u.id) AS resumes,
       (SELECT count(*) FROM learning_paths lp WHERE lp.user_id=u.id) AS "learningPaths",
       (SELECT count(*) FROM messaging_channels mc WHERE mc.user_id=u.id AND mc.status='linked') AS "linkedChannels",
       (SELECT max(created_at) FROM activity_events e WHERE e.user_id=u.id) AS "lastEventAt"
     FROM users u
     WHERE $1::text IS NULL OR lower(u.email) LIKE $1 OR lower(u.full_name) LIKE $1
     ORDER BY u.created_at DESC
     LIMIT $2 OFFSET $3`,
    [like, limit, offset],
  );
  const [{ count }] = await query<{ count: number }>(
    `SELECT count(*)::int AS count FROM users u WHERE $1::text IS NULL OR lower(u.email) LIKE $1 OR lower(u.full_name) LIKE $1`,
    [like],
  );
  return { rows, total: count, limit, offset };
}

export async function getUserDossier(userId: string) {
  const user = await one<Record<string, unknown>>(
    `SELECT u.id, u.full_name AS "fullName", u.email, u.role, u.auth_provider AS "authProvider",
       u.avatar_url AS "avatarUrl", u.created_at AS "createdAt", u.last_seen_at AS "lastSeenAt",
       p.headline, p.current_status AS "currentStatus", p.bio, p.location, p.years_experience AS "yearsExperience",
       p.onboarding_completed AS "onboardingCompleted", r.title AS "targetRoleTitle", p.target_level AS "targetLevel"
     FROM users u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN roles r ON r.id=p.target_role_id
     WHERE u.id=$1`,
    [userId],
  );
  if (!user) return null;

  const [resumes, analyses, roadmaps, learningPaths, channels, notifications, activity, prefs] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT id, filename, mime_type AS "mimeType", file_size AS "fileSize", status,
        document_type AS "documentType", validation_confidence AS "validationConfidence",
        processing_provider AS "processingProvider", parsed_data->>'candidateName' AS "candidateName",
        jsonb_array_length(COALESCE(parsed_data->'skills','[]'::jsonb)) AS "skillCount",
        left(extracted_text, 4000) AS "extractedTextPreview", created_at AS "createdAt"
       FROM resumes WHERE user_id=$1 ORDER BY created_at DESC`,
      [userId],
    ),
    query<Record<string, unknown>>(
      `SELECT a.id, ro.title AS "roleTitle", a.experience_level AS "experienceLevel", a.overall_score AS "overallScore",
        a.technical_score AS "technicalScore", a.soft_score AS "softScore", a.matched_count AS "matchedCount",
        a.developing_count AS "developingCount", a.missing_count AS "missingCount", a.created_at AS "createdAt"
       FROM analyses a JOIN roles ro ON ro.id=a.role_id WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 20`,
      [userId],
    ),
    query<Record<string, unknown>>(
      `SELECT rm.id, rm.title, rm.created_at AS "createdAt",
        (SELECT count(*) FROM roadmap_items ri WHERE ri.roadmap_id=rm.id) AS items,
        (SELECT count(*) FROM roadmap_items ri WHERE ri.roadmap_id=rm.id AND ri.status='completed') AS completed
       FROM roadmaps rm WHERE rm.user_id=$1 ORDER BY rm.created_at DESC LIMIT 10`,
      [userId],
    ),
    query<Record<string, unknown>>(
      `SELECT lp.id, lp.title, lp.total_weeks AS "totalWeeks", lp.weekly_hours AS "weeklyHours", lp.generator,
        lp.status, lp.created_at AS "createdAt",
        (SELECT count(*) FROM learning_path_modules m WHERE m.path_id=lp.id) AS modules,
        (SELECT count(*) FROM learning_path_modules m WHERE m.path_id=lp.id AND m.status='completed') AS completed
       FROM learning_paths lp WHERE lp.user_id=$1 ORDER BY lp.created_at DESC LIMIT 10`,
      [userId],
    ),
    query<Record<string, unknown>>(
      `SELECT platform, status, handle, address IS NOT NULL AS "hasAddress", verified_at AS "verifiedAt", updated_at AS "updatedAt"
       FROM messaging_channels WHERE user_id=$1 ORDER BY platform`,
      [userId],
    ),
    query<Record<string, unknown>>(
      `SELECT kind, status, detail, created_at AS "createdAt" FROM notification_log
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [userId],
    ),
    query<Record<string, unknown>>(
      `SELECT id, action, entity_type AS "entityType", entity_id AS "entityId", metadata, ip, user_agent AS "userAgent", created_at AS "createdAt"
       FROM activity_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 60`,
      [userId],
    ),
    one<Record<string, unknown>>(
      `SELECT notify_roadmap AS "notifyRoadmap", notify_weekly_digest AS "notifyWeeklyDigest",
        notify_analysis AS "notifyAnalysis", notify_inactivity AS "notifyInactivity" FROM preferences WHERE user_id=$1`,
      [userId],
    ),
  ]);

  return { user, resumes, analyses, roadmaps, learningPaths, channels, notifications, activity, preferences: prefs };
}

export async function getActivityFeed(input: { action?: string; userId?: string; limit?: number; offset?: number }) {
  const limit = Math.min(200, Math.max(1, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  return query<Record<string, unknown>>(
    `SELECT e.id, e.action, e.entity_type AS "entityType", e.entity_id AS "entityId", e.metadata,
       e.ip, e.user_agent AS "userAgent", e.created_at AS "createdAt",
       e.user_id AS "userId", COALESCE(u.full_name, e.actor_email) AS "actor", u.email
     FROM activity_events e LEFT JOIN users u ON u.id = e.user_id
     WHERE ($1::text IS NULL OR e.action = $1)
       AND ($2::text IS NULL OR e.user_id = $2)
     ORDER BY e.created_at DESC
     LIMIT $3 OFFSET $4`,
    [input.action ?? null, input.userId ?? null, limit, offset],
  );
}
