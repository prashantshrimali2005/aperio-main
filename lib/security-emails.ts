import "server-only";

import { randomUUID } from "node:crypto";
import { one, query } from "@/lib/db";
import { describeClient, type ClientContext } from "@/lib/request-context";
import {
  buildAccountChangeEmail,
  buildPurchaseEmail,
  buildSignInEmail,
  sendSecurityEmail,
} from "@/lib/email";

const firstName = (fullName?: string | null) => (fullName ?? "").trim().split(/\s+/)[0] || undefined;

/**
 * Claim a one-time slot in notification_log so the same event never emails
 * twice. Returns true if this caller won the claim.
 */
async function claim(userId: string, kind: string, dedupeKey: string) {
  try {
    const row = await one<{ id: string }>(
      `INSERT INTO notification_log (id, user_id, kind, dedupe_key, status)
       VALUES ($1, $2, $3, $4, 'sent')
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [randomUUID(), userId, kind, dedupeKey],
    );
    return Boolean(row);
  } catch (error) {
    console.error("security notification claim failed", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Record the sign-in device and, when it's a new device or a new country,
 * email the user a security alert with device / IP / ISP / location details.
 * Fire-and-forget: never blocks or breaks the auth path.
 */
export async function recordLoginAndNotify(input: {
  userId: string;
  email: string;
  fullName?: string | null;
  method: string;
  request?: Request;
  /** Skip the new-device alert (e.g. this login immediately followed sign-up). */
  suppressNewDeviceAlert?: boolean;
}) {
  try {
    const ctx = await describeClient(input.request);

    const [prior, account] = await Promise.all([
      one<{ id: string; country: string | null }>(
        `SELECT id, country FROM known_devices WHERE user_id = $1 AND fingerprint = $2`,
        [input.userId, ctx.fingerprint],
      ),
      one<{ freshAccount: boolean }>(
        `SELECT (created_at > now() - interval '10 minutes') AS "freshAccount" FROM users WHERE id = $1`,
        [input.userId],
      ),
    ]);
    // A brand-new account's first sign-in is covered by the welcome email — no
    // need for a "new device" alert back-to-back with it.
    const isJustRegistered = Boolean(input.suppressNewDeviceAlert || account?.freshAccount);

    await query(
      `INSERT INTO known_devices
         (id, user_id, fingerprint, label, ip, user_agent, city, region, country, isp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (user_id, fingerprint) DO UPDATE SET
         last_seen_at = now(),
         login_count = known_devices.login_count + 1,
         label = EXCLUDED.label,
         ip = EXCLUDED.ip,
         user_agent = EXCLUDED.user_agent,
         city = COALESCE(EXCLUDED.city, known_devices.city),
         region = COALESCE(EXCLUDED.region, known_devices.region),
         country = COALESCE(EXCLUDED.country, known_devices.country),
         isp = COALESCE(EXCLUDED.isp, known_devices.isp)`,
      [
        randomUUID(),
        input.userId,
        ctx.fingerprint,
        ctx.deviceLabel,
        ctx.ip,
        ctx.userAgent,
        ctx.city,
        ctx.region,
        ctx.country,
        ctx.isp,
      ],
    );

    const isNewDevice = !prior;
    const isNewLocation =
      !isNewDevice && Boolean(ctx.country) && Boolean(prior?.country) && prior?.country !== ctx.country;
    if (!isNewDevice && !isNewLocation) return;
    // New device on a freshly-created account: recorded above, but no alert.
    if (isNewDevice && isJustRegistered) return;

    const dedupeKey = isNewDevice
      ? `sec:login:${input.userId}:${ctx.fingerprint}`
      : `sec:loginloc:${input.userId}:${ctx.fingerprint}:${ctx.country}`;
    if (!(await claim(input.userId, "security_login", dedupeKey))) return;

    const email = buildSignInEmail({
      firstName: firstName(input.fullName),
      method: input.method,
      deviceLabel: ctx.deviceLabel,
      locationLabel: ctx.locationLabel,
      ip: ctx.ip,
      isp: ctx.isp,
      when: ctx.when,
      isNewLocation,
    });
    await sendSecurityEmail(input.email, email, "sign-in alert");
  } catch (error) {
    console.error("recordLoginAndNotify failed", error instanceof Error ? error.message : error);
  }
}

/** Email a receipt after a successful purchase. Deduped per payment. */
export async function sendPurchaseReceipt(input: {
  userId: string;
  paymentId: string;
  title: string;
  itemType: "course" | "question_set";
  amountInr: number;
  currency?: string;
  orderId?: string | null;
  providerPaymentId?: string | null;
}) {
  try {
    const user = await one<{ email: string; fullName: string }>(
      `SELECT email, full_name AS "fullName" FROM users WHERE id = $1`,
      [input.userId],
    );
    if (!user?.email) return;
    if (!(await claim(input.userId, "purchase_receipt", `sec:purchase:${input.paymentId}`))) return;

    const email = buildPurchaseEmail({
      firstName: firstName(user.fullName),
      title: input.title,
      itemType: input.itemType,
      amountInr: input.amountInr,
      currency: input.currency,
      orderId: input.orderId,
      paymentId: input.providerPaymentId,
      when: new Date().toUTCString(),
    });
    await sendSecurityEmail(user.email, email, "purchase receipt");
  } catch (error) {
    console.error("sendPurchaseReceipt failed", error instanceof Error ? error.message : error);
  }
}

/** Email a confirmation when a sensitive account field changes. */
export async function notifyAccountChange(input: {
  userId: string;
  summary: string;
  detail?: string | null;
  request?: Request;
}) {
  try {
    const user = await one<{ email: string; fullName: string }>(
      `SELECT email, full_name AS "fullName" FROM users WHERE id = $1`,
      [input.userId],
    );
    if (!user?.email) return;

    const ctx = await describeClient(input.request);
    const day = new Date().toISOString().slice(0, 10);
    const key = `sec:acct:${input.userId}:${input.summary.toLowerCase().replace(/\s+/g, "_")}:${day}`;
    if (!(await claim(input.userId, "account_change", key))) return;

    const email = buildAccountChangeEmail({
      firstName: firstName(user.fullName),
      summary: input.summary,
      detail: input.detail,
      deviceLabel: ctx.deviceLabel,
      locationLabel: ctx.locationLabel,
      ip: ctx.ip,
      when: ctx.when,
    });
    await sendSecurityEmail(user.email, email, "account change");
  } catch (error) {
    console.error("notifyAccountChange failed", error instanceof Error ? error.message : error);
  }
}

export type { ClientContext };
