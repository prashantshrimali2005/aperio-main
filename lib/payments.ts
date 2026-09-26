import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { one, query } from "@/lib/db";

export type ItemType = "course" | "question_set";

export interface PurchaseReceipt {
  userId: string;
  paymentId: string;
  title: string;
  itemType: ItemType;
  amountInr: number;
  currency: string;
  orderId: string | null;
  providerPaymentId: string | null;
}

export function getRazorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
  return { keyId, keySecret, configured: Boolean(keyId && keySecret) };
}

async function itemPrice(itemType: ItemType, itemId: string) {
  const table = itemType === "course" ? "courses" : "question_sets";
  const row = await one<{ price: number; title: string; published: boolean }>(
    `SELECT price_inr AS price, title, published FROM ${table} WHERE id = $1`,
    [itemId],
  );
  return row;
}

/** True when the user may open this item: it is free, or they have paid for it. */
export async function hasEntitlement(userId: string, itemType: ItemType, itemId: string) {
  const item = await itemPrice(itemType, itemId);
  if (!item) return false;
  if (item.price <= 0) return true;
  const paid = await one<{ id: string }>(
    `SELECT id FROM payments WHERE user_id = $1 AND item_type = $2 AND item_id = $3 AND status = 'paid' LIMIT 1`,
    [userId, itemType, itemId],
  );
  return Boolean(paid);
}

export async function entitlementMap(userId: string, itemType: ItemType, itemIds: string[]) {
  const ids = [...new Set(itemIds)].filter(Boolean);
  const map = new Map<string, boolean>();
  if (!ids.length) return map;
  const rows = await query<{ item_id: string }>(
    `SELECT item_id FROM payments WHERE user_id = $1 AND item_type = $2 AND item_id = ANY($3::text[]) AND status = 'paid'`,
    [userId, itemType, ids],
  );
  for (const r of rows) map.set(r.item_id, true);
  return map;
}

/**
 * Start a purchase. Free items resolve immediately with { free: true }. Paid
 * items create a Razorpay order and a pending payments row.
 */
export async function startPurchase(userId: string, itemType: ItemType, itemId: string) {
  const item = await itemPrice(itemType, itemId);
  if (!item) throw new Error("ITEM_NOT_FOUND");
  if (!item.published) throw new Error("ITEM_NOT_AVAILABLE");

  if (item.price <= 0) return { free: true as const, itemType, itemId };

  if (await hasEntitlement(userId, itemType, itemId)) return { alreadyOwned: true as const, itemType, itemId };

  const cfg = getRazorpayConfig();
  if (!cfg.configured) throw new Error("RAZORPAY_NOT_CONFIGURED");

  const amountPaise = Math.round(item.price * 100);
  const receipt = `apr_${itemType.slice(0, 4)}_${randomUUID().slice(0, 18)}`;
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: { userId, itemType, itemId, title: item.title },
    }),
  });
  const order = (await res.json()) as { id?: string; amount?: number; error?: { description?: string } };
  if (!res.ok || !order.id) throw new Error(order.error?.description || `Razorpay order failed (${res.status})`);

  await query(
    `INSERT INTO payments (id, user_id, item_type, item_id, amount_inr, order_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'created')`,
    [randomUUID(), userId, itemType, itemId, item.price, order.id],
  );

  return {
    free: false as const,
    orderId: order.id,
    amount: amountPaise,
    currency: "INR",
    keyId: cfg.keyId,
    title: item.title,
    itemType,
    itemId,
  };
}

/** Verify a Razorpay checkout callback and, if valid, grant the entitlement. */
export async function confirmPurchase(
  userId: string,
  input: { orderId: string; paymentId: string; signature: string },
) {
  const cfg = getRazorpayConfig();
  if (!cfg.configured) throw new Error("RAZORPAY_NOT_CONFIGURED");

  const expected = createHmac("sha256", cfg.keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  if (expected !== input.signature) throw new Error("BAD_SIGNATURE");

  const pay = await one<{ id: string; itemType: ItemType; itemId: string; status: string; amountInr: number }>(
    `SELECT id, item_type AS "itemType", item_id AS "itemId", status, amount_inr AS "amountInr"
       FROM payments WHERE order_id = $1 AND user_id = $2 LIMIT 1`,
    [input.orderId, userId],
  );
  if (!pay) throw new Error("ORDER_NOT_FOUND");

  let receipt: PurchaseReceipt | null = null;
  if (pay.status !== "paid") {
    await query(
      `UPDATE payments SET status = 'paid', payment_id = $2, paid_at = now() WHERE id = $1`,
      [pay.id, input.paymentId],
    );
    if (pay.itemType === "course") {
      await query(
        `INSERT INTO course_enrollments (id, user_id, course_id, source)
         VALUES ($1, $2, $3, 'self')
         ON CONFLICT (user_id, course_id) DO NOTHING`,
        [randomUUID(), userId, pay.itemId],
      );
    }
    const item = await itemPrice(pay.itemType, pay.itemId);
    receipt = {
      userId,
      paymentId: pay.id,
      title: item?.title ?? (pay.itemType === "course" ? "Course" : "Question set"),
      itemType: pay.itemType,
      amountInr: pay.amountInr,
      currency: "INR",
      orderId: input.orderId,
      providerPaymentId: input.paymentId,
    };
  }
  return { itemType: pay.itemType, itemId: pay.itemId, receipt };
}
