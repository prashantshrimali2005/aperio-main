import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[16px] border border-dashed bg-[var(--surface)] px-6 py-14 text-center", className)}>
      {Icon && (
        <span className="grid size-12 place-items-center rounded-[14px] bg-[var(--primary-soft)] text-[var(--primary)]">
          <Icon size={22} />
        </span>
      )}
      <p className="mt-4 text-[15px] font-semibold tracking-[-.01em]">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
