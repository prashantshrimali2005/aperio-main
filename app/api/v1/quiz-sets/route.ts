import { requireUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { listQuestionSetsForUser } from "@/lib/quiz-bank";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await listQuestionSetsForUser(user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
