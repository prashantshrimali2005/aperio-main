import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

/** Bootstrap allow-list. Not a secret — it only names who is promoted to admin. */
export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  return adminEmails().includes(email.trim().toLowerCase());
}

/**
 * Keep `users.role` in sync with the allow-list on every auth event: promote a
 * listed email, and demote one that was removed from the list.
 */
export async function syncAdminRole(userId: string, email: string) {
  const shouldBeAdmin = isAdminEmail(email);
  await query(
    `UPDATE users SET role=$1, updated_at=now()
     WHERE id=$2 AND role IS DISTINCT FROM $1
       AND ($1 = 'admin' OR role = 'admin')`,
    [shouldBeAdmin ? "admin" : "user", userId],
  );
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

export async function requireAdminPage(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/overview");
  return user;
}
