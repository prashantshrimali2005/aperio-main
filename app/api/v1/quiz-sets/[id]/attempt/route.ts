import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { submitQuestionSetAttempt } from "@/lib/quiz-bank";
import { idSchema, questionSetAttemptSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = idSchema.parse((await context.params).id);
    const input = questionSetAttemptSchema.parse(await request.json());
    const result = await submitQuestionSetAttempt(user.id, id, input.answers);
    await logActivity({
      action: "learning_module.update",
      userId: user.id,
      entityType: "question_set",
      entityId: id,
      metadata: { score: result.score, correct: result.correct, total: result.total },
      request,
    });
    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SET_NOT_FOUND") return fail("NOT_FOUND", "Question set not found.", 404);
    if (error instanceof Error && error.message === "PAYMENT_REQUIRED") return fail("PAYMENT_REQUIRED", "This set is paid — purchase it first.", 402);
    return handleApiError(error);
  }
}
