import { requireUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await query(
      `SELECT us.id,us.skill_id AS "skillId",s.name,s.category,s.description,us.level,us.source,us.confidence,
        us.evidence,us.user_verified AS "userVerified",us.updated_at AS "updatedAt"
       FROM user_skills us JOIN skills s ON s.id=us.skill_id WHERE us.user_id=$1 ORDER BY s.category,s.name`, [user.id],
    );
    return ok(rows);
  } catch (error) { return handleApiError(error); }
}
