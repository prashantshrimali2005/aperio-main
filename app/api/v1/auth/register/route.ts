import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { createSession } from "@/lib/auth";
import { db, one } from "@/lib/db";
import { fail, handleApiError, ok } from "@/lib/api";
import { syncAdminRole } from "@/lib/admin";
import { logActivity } from "@/lib/activity";
import { sendWelcomeEmail } from "@/lib/email";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    const exists = await one("SELECT id FROM users WHERE email=$1", [input.email]);
    if (exists) return fail("EMAIL_IN_USE", "An account with this email already exists.", 409);
    const id = randomUUID();
    const passwordHash = await hash(input.password, 12);
    const sql = db();
    await sql.transaction((tx) => [
      tx`INSERT INTO users (id,email,password_hash,full_name) VALUES (${id},${input.email},${passwordHash},${input.fullName})`,
      tx`INSERT INTO profiles (user_id) VALUES (${id})`,
      tx`INSERT INTO preferences (user_id) VALUES (${id})`,
    ]);
    await createSession(id);
    await syncAdminRole(id, input.email);
    await logActivity({ action: "auth.register", userId: id, actorEmail: input.email, request });
    void sendWelcomeEmail({ email: input.email, fullName: input.fullName });
    return ok({ id, email: input.email, fullName: input.fullName }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
