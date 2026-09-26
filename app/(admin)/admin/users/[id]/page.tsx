import { notFound } from "next/navigation";
import { UserDossier } from "@/components/admin/user-dossier";
import { requireAdminPage } from "@/lib/admin";
import { getUserDossier } from "@/lib/admin-data";

export const metadata = { title: "Admin · User" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const data = await getUserDossier((await params).id);
  if (!data) notFound();
  return <UserDossier data={data as never} />;
}
