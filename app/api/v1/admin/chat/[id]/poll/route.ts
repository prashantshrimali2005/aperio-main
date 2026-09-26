import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError, ok } from "@/lib/api";
import { sendChatPoll } from "@/lib/chat-send";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const id = idSchema.parse((await context.params).id);
    const body = (await request.json().catch(() => ({}))) as { question?: string; options?: string[] };
    if (!body.question?.trim() || !Array.isArray(body.options)) {
      return fail("VALIDATION_ERROR", "Provide a question and options.", 422);
    }
    const result = await sendChatPoll(id, body.question.trim(), body.options, admin.email);
    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "THREAD_NOT_FOUND") return fail("NOT_FOUND", "Thread not found.", 404);
    if (error instanceof Error) return fail("POLL_FAILED", error.message, 502);
    return handleApiError(error);
  }
}
