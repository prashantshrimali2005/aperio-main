import { ActivityFeed } from "@/components/admin/activity-feed";
import { requireAdminPage } from "@/lib/admin";
import { getActivityFeed } from "@/lib/admin-data";

export const metadata = { title: "Admin · Activity" };

export default async function AdminActivityPage() {
  await requireAdminPage();
  const initial = await getActivityFeed({ limit: 120 });
  return <ActivityFeed initial={initial as never} />;
}
