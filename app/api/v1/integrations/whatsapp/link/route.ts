import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { query } from "@/lib/db";
import { newLinkCode } from "@/lib/notifications";
import { linkCodeMessage } from "@/lib/telegram";
import { getWhatsAppConfig } from "@/lib/whatsapp";

export const runtime = "nodejs";

const CODE_TTL_MINUTES = 30;

export async function POST() {
  try {
    const user = await requireUser();
    const cfg = await getWhatsAppConfig();
    if (!cfg.configured) {
      return fail("PROVIDER_NOT_CONFIGURED", "WhatsApp is not configured yet. An admin can add the Cloud API credentials in the admin area.", 503);
    }
    const code = newLinkCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
    await query(
      `INSERT INTO messaging_channels (id, user_id, platform, status, link_code, link_code_expires_at, updated_at)
       VALUES ($1,$2,'whatsapp','pending',$3,$4, now())
       ON CONFLICT (user_id, platform)
       DO UPDATE SET status='pending', link_code=EXCLUDED.link_code, link_code_expires_at=EXCLUDED.link_code_expires_at,
         address=NULL, verified_at=NULL, updated_at=now()`,
      [randomUUID(), user.id, code, expiresAt],
    );
    const message = linkCodeMessage(code);
    const deepLink = cfg.businessNumber ? `https://wa.me/${cfg.businessNumber}?text=${encodeURIComponent(message)}` : null;
    return ok({
      code,
      message,
      expiresAt,
      deepLink,
      instructions: cfg.businessNumber
        ? `Open the link, or message +${cfg.businessNumber} on WhatsApp with:\n\n${message}`
        : `Message the Aperio WhatsApp number with:\n\n${message}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
