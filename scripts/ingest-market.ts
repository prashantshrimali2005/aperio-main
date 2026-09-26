/**
 * Manual / local runner for job + market ingestion.
 *
 * On the deployed app this runs daily via the Vercel cron at /api/v1/cron/market,
 * and on demand from Admin → Job market → "Run ingestion now". Use this to run it
 * by hand or from your own scheduler.
 *
 * It reads the enabled rows in `market_sources` (integration key `jobs.arbeitnow`
 * is supported), stores the real postings in `job_postings` with the catalog
 * skills each one mentions, and writes a dated demand observation per skill.
 *
 * Run: tsx scripts/ingest-market.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

async function main() {
  const { runJobIngestion } = await import("../lib/jobs");
  const result = await runJobIngestion();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
