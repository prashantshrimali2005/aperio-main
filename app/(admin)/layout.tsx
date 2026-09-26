import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/admin";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return <AdminShell adminName={admin.email}>{children}</AdminShell>;
}
