import { requireAdmin } from "@/lib/admin";
import { fail, handleApiError, ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { sendUserbotLoginCode, signInUserbot, userbotStatus } from "@/lib/telegram-userbot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    await requireAdmin();
    return ok(await userbotStatus());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as { action?: string; code?: string; password?: string };

    if (body.action === "send-code") {
      const result = await sendUserbotLoginCode();
      await logActivity({ action: "admin.integration.save", userId: admin.id, actorEmail: admin.email, entityType: "integration", entityId: "telegram.userbot", metadata: { step: "send-code" }, request });
      return ok(result);
    }

    if (body.action === "sign-in") {
      if (!body.code) return fail("VALIDATION_ERROR", "Enter the OTP code.", 422);
      const result = await signInUserbot(String(body.code).replace(/\D/g, ""), body.password || undefined);
      await logActivity({ action: "admin.integration.save", userId: admin.id, actorEmail: admin.email, entityType: "integration", entityId: "telegram.userbot", metadata: { step: "sign-in", linked: true }, request });
      return ok(result);
    }

    return fail("VALIDATION_ERROR", "Unknown action.", 422);
  } catch (error) {
    if (error instanceof Error) {
      const map: Record<string, [string, string, number]> = {
        USERBOT_CREDS_MISSING: ["CREDS_MISSING", "Save the API ID, API hash, and phone number first.", 422],
        NO_PENDING_LOGIN: ["NO_PENDING_LOGIN", "Send an OTP first.", 409],
        PASSWORD_REQUIRED: ["PASSWORD_REQUIRED", "This account has two-step verification. Enter the password too.", 401],
        PHONE_CODE_INVALID: ["PHONE_CODE_INVALID", "That code is wrong or expired. Send a new one.", 401],
      };
      const hit = map[error.message];
      if (hit) return fail(hit[0], hit[1], hit[2]);
    }
    return handleApiError(error);
  }
}
