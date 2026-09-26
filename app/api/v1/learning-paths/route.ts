import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { createLearningPath, getLearningPath } from "@/lib/learning";
import { logActivity } from "@/lib/activity";
import { learningPathSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await getLearningPath(user.id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = learningPathSchema.parse(await request.json().catch(() => ({})));
    const path = await createLearningPath(user.id, input.analysisId ?? null, input.weeklyHours);
    await logActivity({
      action: "learning_path.generate", userId: user.id, entityType: "learning_path", entityId: path.id,
      metadata: { weeks: path.totalWeeks, weeklyHours: path.weeklyHours, generator: path.generator },
      request,
    });
    return ok(path, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ANALYSIS_NOT_FOUND") {
      return fail("ANALYSIS_NOT_FOUND", "Run an analysis first so Aperio has gaps to plan around.", 422);
    }
    if (error instanceof Error && error.message === "NO_GAPS") {
      return fail("NO_GAPS", "This analysis has no open gaps — nothing to build a path from.", 422);
    }
    return handleApiError(error);
  }
}
