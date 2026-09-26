import { handleApiError, ok, fail } from "@/lib/api";
import { one, query } from "@/lib/db";
import { idSchema } from "@/lib/validation";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = idSchema.parse((await context.params).id);
    const role = await one<Record<string, unknown>>("SELECT id,slug,title,description,category FROM roles WHERE id=$1 AND active=true", [id]);
    if (!role) return fail("NOT_FOUND", "Role not found.", 404);
    const requirements = await query<Record<string, unknown>>(
      `SELECT s.id AS "skillId",s.name,s.category,r.target_level AS "targetLevel",r.importance,r.experience_level AS "experienceLevel",r.weight
       FROM role_skill_requirements r JOIN skills s ON s.id=r.skill_id WHERE r.role_id=$1 ORDER BY r.experience_level,r.weight DESC`, [id],
    );
    return ok({ ...role, requirements });
  } catch (error) { return handleApiError(error); }
}
