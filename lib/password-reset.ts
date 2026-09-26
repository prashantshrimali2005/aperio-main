import "server-only";

import { hash as bcryptHash } from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { one, query } from "@/lib/db";
import { primaryOrigin } from "@/lib/origin";
import { describeClient } from "@/lib/request-context";
import {
  buildPasswordResetEmail,
  buildPasswordResetGoogleEmail,
  sendSecurityEmail,
} from "@/lib/email";

const TTL_MINUTES = 60;
const MAX_PER_WINDOW = 3; // reset requests per user per 15 min
const APP_URL = primaryOrigin("https://aperio-umber.vercel.app");

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const firstName = (fullName?: string | null) => (fullName ?? "").trim().split(/\s+/)[0] || undefined;

/**
 * Start a password reset. Always resolves without revealing whether the address
 * exists. Sends a one-time link for password accounts, a "you use Google" note
 * for Google-only accounts, and nothing for unknown addresses.
 */
export async function requestPasswordReset(email: string, request?: Request) {
  try {
    const user = await one<{ id: string; fullName: string; passwordHash: string | null }>(
      `SELECT id, full_name AS "fullName", password_hash AS "passwordHash" FROM users WHERE email = $1`,
      [email],
    );
    if (!user) return;

    const ctx = await describeClient(request);
    const when = ctx.when;

    if (!user.passwordHash) {
      await sendSecurityEmail(
        email,
        buildPasswordResetGoogleEmail({ firstName: firstName(user.fullName), email, when }),
        "password reset (google account)",
      );
      return;
    }

    const recent = await one<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM password_reset_tokens
       WHERE user_id = $1 AND created_at > now() - interval '15 minutes'`,
      [user.id],
    );
    if ((recent?.n ?? 0) >= MAX_PER_WINDOW) return;

    // Retire any still-valid tokens so only the newest link works.
    await query(
      `UPDATE password_reset_tokens SET used_at = now()
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id],
    );

    const token = randomBytes(32).toString("base64url");
    await query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, requested_ip)
       VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval, $5)`,
      [randomUUID(), user.id, tokenHash(token), String(TTL_MINUTES), ctx.ip],
    );

    const url = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await sendSecurityEmail(
      email,
      buildPasswordResetEmail({ firstName: firstName(user.fullName), url, ip: ctx.ip, when, ttlMinutes: TTL_MINUTES }),
      "password reset",
    );
  } catch (error) {
    console.error("requestPasswordReset failed", error instanceof Error ? error.message : error);
  }
}

export interface PasswordResetResult {
  userId: string;
  email: string;
}

/**
 * Consume a reset token and set a new password. Throws "INVALID_TOKEN" when the
 * token is unknown, already used, or expired. On success every existing session
 * for the account is revoked.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<PasswordResetResult> {
  const row = await one<{ id: string; userId: string }>(
    `SELECT id, user_id AS "userId" FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     LIMIT 1`,
    [tokenHash(token)],
  );
  if (!row) throw new Error("INVALID_TOKEN");

  const user = await one<{ email: string }>("SELECT email FROM users WHERE id = $1", [row.userId]);
  if (!user) throw new Error("INVALID_TOKEN");

  const passwordHash = await bcryptHash(newPassword, 12);
  await query(
    `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
    [passwordHash, row.userId],
  );
  await query(`UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [row.userId]);
  // Force re-authentication everywhere.
  await query(`DELETE FROM sessions WHERE user_id = $1`, [row.userId]);

  return { userId: row.userId, email: user.email };
}
