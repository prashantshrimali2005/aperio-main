import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { getAssessment } from "@/lib/assessment";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = idSchema.parse((await context.params).id);
    const assessment = await getAssessment(user.id, id);
    return assessment ? ok(assessment) : fail("NOT_FOUND", "Assessment not found.", 404);
  } catch (error) {
    return handleApiError(error);
  }
}
