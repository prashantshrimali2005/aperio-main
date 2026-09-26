import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { setModuleStatus } from "@/lib/learning";
import { idSchema, learningModuleSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = idSchema.parse((await context.params).id);
    const input = learningModuleSchema.parse(await request.json());
    const updated = await setModuleStatus(user.id, id, input.status);
    return updated ? ok(updated) : fail("NOT_FOUND", "Module not found.", 404);
  } catch (error) {
    return handleApiError(error);
  }
}
