import { requireUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { one } from "@/lib/db";
import { getIntegrationsState } from "@/lib/integrations";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    const user = await requireUser();

    // If this user is mid-link to the Telegram user bot, kick a sync so the code
    // they just sent gets picked up without waiting for the cron.
    const pending = await one<{ id: string }>(
      `SELECT id FROM messaging_channels WHERE user_id=$1 AND platform='telegram' AND via='userbot' AND status='pending'`,
      [user.id],
    );
    if (pending) {
      const { syncUserbotMessages } = await import("@/lib/telegram-userbot");
      await syncUserbotMessages(6, 20).catch(() => {});
    }

    return ok(await getIntegrationsState(user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
