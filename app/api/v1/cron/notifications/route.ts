import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { runInactivityNudges, runRoadmapReminders, runWeeklyDigest } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

async function handle(request: Request) {
  if (!authorized(request)) return fail("UNAUTHORIZED", "Invalid or missing cron secret.", 401);
  const job = new URL(request.url).searchParams.get("job") ?? "all";
  const results: Record<string, unknown> = {};
  if (job === "roadmap" || job === "all") results.roadmap = await runRoadmapReminders();
  if (job === "weekly" || job === "all") results.weekly = await runWeeklyDigest();
  if (job === "inactivity" || job === "all") results.inactivity = await runInactivityNudges();
  return ok({ job, results });
}

// Vercel Cron issues GET with `Authorization: Bearer $CRON_SECRET`.
export const GET = handle;
export const POST = handle;

export function OPTIONS() {
  return NextResponse.json({ ok: true });
}
