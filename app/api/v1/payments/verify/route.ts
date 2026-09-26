import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { confirmPurchase } from "@/lib/payments";
import { sendPurchaseReceipt } from "@/lib/security-emails";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(4).max(80),
  paymentId: z.string().min(4).max(80),
  signature: z.string().min(16).max(256),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = schema.parse(await request.json());
    const { receipt, ...result } = await confirmPurchase(user.id, input);
    if (receipt) after(() => sendPurchaseReceipt(receipt));
    return ok({ granted: true, ...result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "BAD_SIGNATURE") return fail("BAD_SIGNATURE", "Payment could not be verified.", 400);
      if (error.message === "ORDER_NOT_FOUND") return fail("NOT_FOUND", "Order not found.", 404);
      if (error.message === "RAZORPAY_NOT_CONFIGURED") return fail("PAYMENTS_OFF", "Payments are not configured.", 503);
    }
    return handleApiError(error);
  }
}
