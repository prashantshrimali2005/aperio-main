import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError, ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { generateQuestionSet, listQuestionSets } from "@/lib/quiz-bank";
import { questionSetGenerateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    await requireAdmin();
    return ok(await listQuestionSets());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const input = questionSetGenerateSchema.parse(await request.json());
    const set = await generateQuestionSet(input, admin.email);
    await logActivity({
      action: "admin.integration.save",
      userId: admin.id,
      actorEmail: admin.email,
      entityType: "question_set",
      entityId: set?.id,
      metadata: { topic: input.topic, niche: input.niche ?? "General" },
      request,
    });
    return ok(set, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "GEMINI_NOT_CONFIGURED") return fail("GEMINI_NOT_CONFIGURED", "Set GEMINI_API_KEY first.", 422);
      if (error.message === "DUPLICATE_SET") return fail("DUPLICATE", "A set for that niche + topic already exists.", 409);
      if (error.message.startsWith("GEMINI_")) return fail("GENERATION_FAILED", "Gemini could not build that set — try a more specific topic.", 502);
    }
    return handleApiError(error);
  }
}
