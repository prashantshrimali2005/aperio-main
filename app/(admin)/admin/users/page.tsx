import { UserTable } from "@/components/admin/user-table";
import { requireAdminPage } from "@/lib/admin";
import { getUserList } from "@/lib/admin-data";

export const metadata = { title: "Admin · Users" };

export default async function AdminUsersPage() {
  await requireAdminPage();
  const initial = await getUserList({ limit: 60 });
  return <UserTable initial={initial as never} />;
}
