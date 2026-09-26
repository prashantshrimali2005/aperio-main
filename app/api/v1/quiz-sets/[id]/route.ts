import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { getQuestionSetForUser } from "@/lib/quiz-bank";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = idSchema.parse((await context.params).id);
    const set = await getQuestionSetForUser(user.id, id);
    return set ? ok(set) : fail("NOT_FOUND", "Question set not found.", 404);
  } catch (error) {
    return handleApiError(error);
  }
}
