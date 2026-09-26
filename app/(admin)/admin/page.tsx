import { AdminOverview } from "@/components/admin/admin-overview";
import { requireAdminPage } from "@/lib/admin";
import { getAdminOverview } from "@/lib/admin-data";

export const metadata = { title: "Admin · Overview" };

export default async function AdminOverviewPage() {
  await requireAdminPage();
  const data = await getAdminOverview();
  return <AdminOverview data={data as never} />;
}
