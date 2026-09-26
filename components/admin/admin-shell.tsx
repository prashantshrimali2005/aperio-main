"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowLeft, GraduationCap, LayoutDashboard, LineChart, MessagesSquare, Plug, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/chat", label: "Chat", icon: MessagesSquare },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/lms", label: "LMS", icon: GraduationCap },
  { href: "/admin/market", label: "Job market", icon: LineChart },
  { href: "/admin/integrations", label: "Integrations", icon: Plug },
];

export function AdminShell({ children, adminName }: { children: React.ReactNode; adminName: string }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[var(--background)] lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-30 flex h-14 items-center gap-1 overflow-x-auto border-b bg-[var(--surface)] px-3 lg:h-screen lg:flex-col lg:items-stretch lg:gap-1 lg:border-b-0 lg:border-r lg:px-4 lg:py-5">
        <div className="hidden px-2 pb-4 lg:block">
          <p className="text-sm font-bold tracking-tight">Aperio Admin</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{adminName}</p>
        </div>
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13px] font-medium transition-colors",
                active ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]" : "text-[var(--muted-strong)] hover:bg-[var(--surface-muted)]",
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
        <Link href="/overview" className="mt-auto hidden items-center gap-2 rounded-[9px] px-3 py-2 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)] lg:flex">
          <ArrowLeft size={14} />
          Back to app
        </Link>
      </aside>
      <main className="min-w-0 px-5 py-7 lg:px-9 lg:py-9">{children}</main>
    </div>
  );
}
