import { requireAdmin } from "@/lib/admin";
import { handleApiError, ok } from "@/lib/api";
import { syncUserbotMessages } from "@/lib/telegram-userbot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    await requireAdmin();
    const result = await syncUserbotMessages(25, 25, { budgetMs: 40_000 }).catch((error) => ({ error: error instanceof Error ? error.message : "sync failed" }));
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
