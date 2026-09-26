import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { enrollInCourse } from "@/lib/lms";
import { startPurchase } from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  itemType: z.enum(["course", "question_set"]),
  itemId: z.string().min(2).max(100),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { itemType, itemId } = schema.parse(await request.json());
    const result = await startPurchase(user.id, itemType, itemId);

    // Free course → enroll right away so the learner lands in it.
    if (("free" in result && result.free) || ("alreadyOwned" in result && result.alreadyOwned)) {
      if (itemType === "course") await enrollInCourse(user.id, itemId, "self").catch(() => {});
      return ok({ granted: true, itemType, itemId });
    }
    return ok(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ITEM_NOT_FOUND") return fail("NOT_FOUND", "That item no longer exists.", 404);
      if (error.message === "ITEM_NOT_AVAILABLE") return fail("UNAVAILABLE", "That item is not available.", 409);
      if (error.message === "RAZORPAY_NOT_CONFIGURED") return fail("PAYMENTS_OFF", "Payments are not configured yet. Ask the admin to add the Razorpay key.", 503);
      if (error.message.startsWith("Razorpay")) return fail("PROVIDER", error.message, 502);
    }
    return handleApiError(error);
  }
}
