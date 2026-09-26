import { MarketSources } from "@/components/admin/market-sources";
import { requireAdminPage } from "@/lib/admin";
import { getJobStats } from "@/lib/jobs";
import { listMarketSources } from "@/lib/market";
import { INTEGRATION_SCHEMAS } from "@/lib/settings";

export const metadata = { title: "Admin · Job market" };

export default async function AdminMarketPage() {
  await requireAdminPage();
  const [sources, stats] = await Promise.all([listMarketSources(), getJobStats()]);
  const integrationKeys = INTEGRATION_SCHEMAS.filter((s) => s.key.startsWith("jobs.")).map((s) => ({ key: s.key, title: s.title }));
  return <MarketSources initial={{ sources: sources as never, integrationKeys, stats: stats as never }} />;
}
