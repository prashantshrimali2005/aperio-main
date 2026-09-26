import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { setPracticeStatus } from "@/lib/practice";
import { idSchema, progressStatusSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = idSchema.parse((await context.params).id);
    const input = progressStatusSchema.parse(await request.json());
    const updated = await setPracticeStatus(user.id, id, input.status);
    return updated ? ok(updated) : fail("NOT_FOUND", "Practice session not found.", 404);
  } catch (error) {
    return handleApiError(error);
  }
}
