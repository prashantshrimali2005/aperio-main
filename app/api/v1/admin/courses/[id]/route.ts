import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError, ok } from "@/lib/api";
import { deleteCourse, getCourse } from "@/lib/lms";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const id = idSchema.parse((await context.params).id);
    const course = await getCourse(id);
    return course ? ok(course) : fail("NOT_FOUND", "Course not found.", 404);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const id = idSchema.parse((await context.params).id);
    await deleteCourse(id);
    return ok({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
