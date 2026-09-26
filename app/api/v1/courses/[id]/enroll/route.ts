import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { enrollInCourse } from "@/lib/lms";
import { logActivity } from "@/lib/activity";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = idSchema.parse((await context.params).id);
    const body = (await request.json().catch(() => ({}))) as { source?: "self" | "recommended" };
    const course = await enrollInCourse(user.id, id, body.source === "recommended" ? "recommended" : "self");
    await logActivity({ action: "learning_module.update", userId: user.id, entityType: "course", entityId: id, metadata: { enrolled: true }, request });
    return ok(course, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "COURSE_NOT_FOUND") return fail("NOT_FOUND", "Course not found or not published.", 404);
    if (error instanceof Error && error.message === "PAYMENT_REQUIRED") return fail("PAYMENT_REQUIRED", "This course is paid — purchase it first.", 402);
    return handleApiError(error);
  }
}
