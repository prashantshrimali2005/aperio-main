import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { setLessonProgress } from "@/lib/lms";
import { idSchema, progressStatusSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = idSchema.parse((await context.params).id);
    const input = progressStatusSchema.parse(await request.json());
    return ok(await setLessonProgress(user.id, id, input.status));
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_ENROLLED") return fail("NOT_ENROLLED", "Enrol in the course first.", 403);
    return handleApiError(error);
  }
}
