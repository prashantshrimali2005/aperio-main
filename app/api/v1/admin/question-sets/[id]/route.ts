import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError, ok } from "@/lib/api";
import { deleteQuestionSet, getQuestionSet, setQuestionSetPrice, setQuestionSetPublished } from "@/lib/quiz-bank";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const id = idSchema.parse((await context.params).id);
    const set = await getQuestionSet(id);
    return set ? ok(set) : fail("NOT_FOUND", "Question set not found.", 404);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const id = idSchema.parse((await context.params).id);
    const body = (await request.json().catch(() => ({}))) as { published?: boolean; priceInr?: number };
    if (typeof body.published === "boolean") await setQuestionSetPublished(id, body.published);
    if (typeof body.priceInr === "number") await setQuestionSetPrice(id, body.priceInr);
    if (typeof body.published !== "boolean" && typeof body.priceInr !== "number") {
      return fail("VALIDATION_ERROR", "Pass { published } and/or { priceInr }.", 422);
    }
    return ok({ id, ...(typeof body.published === "boolean" ? { published: body.published } : {}), ...(typeof body.priceInr === "number" ? { priceInr: body.priceInr } : {}) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const id = idSchema.parse((await context.params).id);
    await deleteQuestionSet(id);
    return ok({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
