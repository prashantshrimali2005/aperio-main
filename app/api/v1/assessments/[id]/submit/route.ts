import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { submitAssessment } from "@/lib/assessment";
import { logActivity } from "@/lib/activity";
import { assessmentSubmitSchema, idSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = idSchema.parse((await context.params).id);
    const input = assessmentSubmitSchema.parse(await request.json());
    const result = await submitAssessment(user.id, id, input.answers);
    await logActivity({
      action: "analysis.run",
      userId: user.id,
      entityType: "assessment",
      entityId: id,
      metadata: { assessmentScore: result.score, reanalysed: Boolean(result.newAnalysisId) },
      request,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return fail("NOT_FOUND", "Assessment not found.", 404);
      if (error.message === "ALREADY_COMPLETED") return fail("ALREADY_COMPLETED", "This test was already submitted.", 409);
    }
    return handleApiError(error);
  }
}
