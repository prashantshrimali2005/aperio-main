"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "system";
const ORDER: Mode[] = ["light", "dark", "system"];
const META: Record<Mode, { label: string; icon: typeof Sun }> = {
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
  system: { label: "System", icon: Monitor },
};

export function ThemeToggle({ showLabel = false, className }: { showLabel?: boolean; className?: string }) {
  const { theme, setTheme, systemTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);

  const mode: Mode = mounted && ORDER.includes(theme as Mode) ? (theme as Mode) : "system";
  const { label, icon: Icon } = META[mode];
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
  const resolvedHint = mode === "system" && mounted ? ` (currently ${systemTheme ?? "light"})` : "";

  return <button onClick={() => setTheme(next)} className={cn("flex h-9 items-center justify-center gap-2.5 rounded-[9px] border bg-[var(--surface)] px-2.5 text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]", showLabel && "w-full justify-start px-3", className)} aria-label={`Theme: ${label}${resolvedHint}. Switch to ${META[next].label}.`} title={`Theme: ${label}${resolvedHint}`}>
    <Icon size={16} />
    {showLabel && <span className="text-xs font-medium">{label} theme</span>}
    {showLabel && <span className="ml-auto flex gap-1">{ORDER.map((m) => <span key={m} className={cn("size-1.5 rounded-full bg-[var(--border-strong)] transition-colors", m === mode && "bg-[var(--primary)]")} />)}</span>}
  </button>;
}
