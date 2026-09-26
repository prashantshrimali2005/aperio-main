import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError, ok } from "@/lib/api";
import { suggestCourseTopics } from "@/lib/lms";
import { courseTopicSuggestSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = courseTopicSuggestSchema.parse(await request.json().catch(() => ({})));
    const topics = await suggestCourseTopics(input.focus);
    return ok({ topics });
  } catch (error) {
    if (error instanceof Error && error.message === "GEMINI_NOT_CONFIGURED") {
      return fail("GEMINI_NOT_CONFIGURED", "Set GEMINI_API_KEY first.", 422);
    }
    return handleApiError(error);
  }
}
