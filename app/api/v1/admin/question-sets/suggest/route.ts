import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError, ok } from "@/lib/api";
import { suggestQuestionSetTopics } from "@/lib/quiz-bank";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as { niche?: string };
    const topics = await suggestQuestionSetTopics(body.niche?.trim() || undefined);
    return ok({ topics });
  } catch (error) {
    if (error instanceof Error && error.message === "GEMINI_NOT_CONFIGURED") {
      return fail("GEMINI_NOT_CONFIGURED", "Set GEMINI_API_KEY first.", 422);
    }
    return handleApiError(error);
  }
}
