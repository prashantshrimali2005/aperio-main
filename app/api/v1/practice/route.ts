import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { createPracticeSession, listPracticeSessions, suggestedPracticeSkills } from "@/lib/practice";
import { logActivity } from "@/lib/activity";
import { practiceCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const user = await requireUser();
    const [sessions, suggestions] = await Promise.all([
      listPracticeSessions(user.id),
      suggestedPracticeSkills(user.id),
    ]);
    return ok({ sessions, suggestions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = practiceCreateSchema.parse(await request.json());
    const session = await createPracticeSession(user.id, input.skillId, input.analysisId ?? null);
    await logActivity({ action: "learning_module.update", userId: user.id, entityType: "practice", entityId: session?.id, metadata: { skillId: input.skillId }, request });
    return ok(session, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SKILL_NOT_FOUND") return fail("NOT_FOUND", "Skill not found.", 404);
    return handleApiError(error);
  }
}
