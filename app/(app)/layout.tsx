import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/lib/auth";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return <AppShell user={user}>{children}</AppShell>;
}
