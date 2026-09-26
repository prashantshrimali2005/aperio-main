"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({
  children,
  className,
  align = "end",
  sideOffset = 8,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  sideOffset?: number;
}) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[220px] overflow-hidden rounded-[13px] border bg-[var(--surface)] p-1.5 shadow-[var(--shadow-raised)] focus:outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-1",
          className,
        )}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  children,
  className,
  onSelect,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  onSelect?: (event: Event) => void;
  disabled?: boolean;
  tone?: "default" | "critical";
}) {
  return (
    <Menu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13px] font-medium outline-none transition-colors",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        tone === "critical"
          ? "text-[var(--critical)] data-[highlighted]:bg-[var(--critical-soft)]"
          : "text-[var(--muted-strong)] data-[highlighted]:bg-[var(--surface-muted)] data-[highlighted]:text-[var(--foreground)]",
        className,
      )}
    >
      {children}
    </Menu.Item>
  );
}

export function DropdownMenuLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-2.5 pb-1.5 pt-1", className)}>{children}</div>;
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <Menu.Separator className={cn("my-1.5 h-px bg-[var(--border)]", className)} />;
}
