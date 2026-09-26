import { requireUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { query } from "@/lib/db";
import { notificationPreferencesSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const input = notificationPreferencesSchema.parse(await request.json());
    const rows = await query<Record<string, unknown>>(
      `UPDATE preferences SET
        notify_roadmap = COALESCE($1, notify_roadmap),
        notify_weekly_digest = COALESCE($2, notify_weekly_digest),
        notify_analysis = COALESCE($3, notify_analysis),
        notify_inactivity = COALESCE($4, notify_inactivity),
        notify_email = COALESCE($5, notify_email),
        updated_at = now()
       WHERE user_id=$6
       RETURNING notify_roadmap AS "notifyRoadmap", notify_weekly_digest AS "notifyWeeklyDigest",
        notify_analysis AS "notifyAnalysis", notify_inactivity AS "notifyInactivity", notify_email AS "notifyEmail"`,
      [
        input.notifyRoadmap ?? null,
        input.notifyWeeklyDigest ?? null,
        input.notifyAnalysis ?? null,
        input.notifyInactivity ?? null,
        input.notifyEmail ?? null,
        user.id,
      ],
    );
    return ok(rows[0] ?? {});
  } catch (error) {
    return handleApiError(error);
  }
}
