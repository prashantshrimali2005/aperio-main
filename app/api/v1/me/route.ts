import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { one, query } from "@/lib/db";
import { notifyAccountChange } from "@/lib/security-emails";
import { profileSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await one<Record<string, unknown>>(
      `SELECT u.id,u.email,u.full_name AS "fullName",p.headline,p.current_status AS "currentStatus",p.bio,p.location,
        p.years_experience AS "yearsExperience",p.target_role_id AS "targetRoleId",p.target_level AS "targetLevel",
        p.onboarding_completed AS "onboardingCompleted",r.title AS "targetRoleTitle"
       FROM users u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN roles r ON r.id=p.target_role_id WHERE u.id=$1`, [user.id],
    );
    return ok(profile);
  } catch (error) { return handleApiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const input = profileSchema.parse(await request.json());
    const nameChanged = Boolean(input.fullName && input.fullName !== user.fullName);
    if (input.fullName) await query("UPDATE users SET full_name=$1,updated_at=now() WHERE id=$2", [input.fullName, user.id]);
    if (nameChanged) {
      const from = user.fullName;
      const to = input.fullName!;
      after(() =>
        notifyAccountChange({
          userId: user.id,
          summary: "Your name was changed",
          detail: `The name on your Aperio account was changed from “${from}” to “${to}”.`,
          request,
        }),
      );
    }
    await query(
      `UPDATE profiles SET
        headline=COALESCE($1,headline),current_status=COALESCE($2,current_status),bio=COALESCE($3,bio),
        location=COALESCE($4,location),years_experience=COALESCE($5,years_experience),
        target_role_id=COALESCE($6,target_role_id),target_level=COALESCE($7,target_level),
        onboarding_completed=COALESCE($8,onboarding_completed),updated_at=now() WHERE user_id=$9`,
      [input.headline, input.currentStatus, input.bio, input.location, input.yearsExperience, input.targetRoleId, input.targetLevel, input.onboardingCompleted, user.id],
    );
    return GET();
  } catch (error) { return handleApiError(error); }
}
