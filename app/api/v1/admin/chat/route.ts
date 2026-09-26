import { after } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { handleApiError, ok } from "@/lib/api";
import { one } from "@/lib/db";
import { listThreads } from "@/lib/chat";
import { syncUserbotMessages } from "@/lib/telegram-userbot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const channel = params.get("channel") || "all";
    const q = params.get("q")?.trim() || undefined;

    // Opportunistically refresh the Telegram user bot while the workspace is open.
    if (channel === "all" || channel === "telegram") {
      const state = await one<{ stale: boolean }>(
        `SELECT (synced_at IS NULL OR synced_at < now() - interval '10 seconds') AS stale FROM chat_sync_state WHERE channel='telegram_userbot'`,
      );
      // Keep the opportunistic sync small so it releases the session lock fast
      // and never makes an in-flight send/poll time out. Run it via after() so
      // the sync + any queued AI replies finish instead of being frozen.
      if (!state || state.stale) after(() => syncUserbotMessages(12, 10, { budgetMs: 18_000 }).catch(() => {}));
    }

    return ok({ threads: await listThreads({ channel, q }) });
  } catch (error) {
    return handleApiError(error);
  }
}
