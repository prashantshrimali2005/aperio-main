import { fail, ok } from "@/lib/api";
import { runJobIngestion } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

async function handle(request: Request) {
  if (!authorized(request)) return fail("UNAUTHORIZED", "Invalid or missing cron secret.", 401);
  return ok(await runJobIngestion());
}

export const GET = handle;
export const POST = handle;
