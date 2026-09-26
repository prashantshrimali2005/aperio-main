import { requireAdmin } from "@/lib/admin";
import { handleApiError, ok } from "@/lib/api";
import { deleteMarketSource } from "@/lib/market";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const id = idSchema.parse((await context.params).id);
    await deleteMarketSource(id);
    return ok({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
