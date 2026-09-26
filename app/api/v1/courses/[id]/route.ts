import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { getCourseForLearner } from "@/lib/lms";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = idSchema.parse((await context.params).id);
    const course = await getCourseForLearner(user.id, id);
    return course ? ok(course) : fail("NOT_FOUND", "Course not found.", 404);
  } catch (error) {
    return handleApiError(error);
  }
}
