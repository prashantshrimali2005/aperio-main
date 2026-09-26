import { fail, ok } from "@/lib/api";
import { syncUserbotMessages } from "@/lib/telegram-userbot";

// Not registered in vercel.json (Hobby allows only 2 daily crons). Point an
// external scheduler at this with `?secret=<CRON_SECRET>` for background
// Telegram sync; otherwise sync runs opportunistically while /admin/chat is open.
export const runtime = "nodejs";
export const maxDuration = 120;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

async function handle(request: Request) {
  if (!authorized(request)) return fail("UNAUTHORIZED", "Invalid or missing cron secret.", 401);
  return ok(await syncUserbotMessages(40, 60, { budgetMs: 100_000 }).catch((error) => ({ error: error instanceof Error ? error.message : "sync failed" })));
}

export const GET = handle;
export const POST = handle;
