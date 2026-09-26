import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError, ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { generateCourseDraft } from "@/lib/lms";
import { courseGenerateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const input = courseGenerateSchema.parse(await request.json());
    const result = await generateCourseDraft(input, admin.email);
    await logActivity({
      action: "admin.integration.save",
      userId: admin.id,
      actorEmail: admin.email,
      entityType: "course",
      entityId: result.course?.id,
      metadata: { generated: true, topic: input.topic },
      request,
    });
    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "GEMINI_NOT_CONFIGURED") return fail("GEMINI_NOT_CONFIGURED", "Set GEMINI_API_KEY first.", 422);
      if (error.message === "DUPLICATE_COURSE") return fail("DUPLICATE", "A course with that title already exists — pick a different topic.", 409);
      if (error.message.startsWith("GEMINI_")) return fail("GENERATION_FAILED", "Gemini could not build that course — try a more specific topic.", 502);
    }
    return handleApiError(error);
  }
}
