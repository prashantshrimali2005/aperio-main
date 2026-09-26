import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { one, query } from "@/lib/db";
import { idSchema, userSkillSchema } from "@/lib/validation";
import { skillLevelValue } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const skillId = idSchema.parse((await context.params).id);
    const input = userSkillSchema.parse(await request.json());
    const skill = await one("SELECT id FROM skills WHERE id=$1", [skillId]);
    if (!skill) return fail("NOT_FOUND", "Skill not found.", 404);
    await query(
      `INSERT INTO user_skills (id,user_id,skill_id,level,source,confidence,evidence,user_verified)
       VALUES ($1,$2,$3,$4,'manual',1,'[]'::jsonb,$5)
       ON CONFLICT (user_id,skill_id) DO UPDATE SET level=EXCLUDED.level,source='manual',confidence=1,user_verified=EXCLUDED.user_verified,updated_at=now()`,
      [randomUUID(), user.id, skillId, skillLevelValue[input.level], input.userVerified],
    );
    return ok({ skillId, level: skillLevelValue[input.level], userVerified: input.userVerified });
  } catch (error) { return handleApiError(error); }
}
