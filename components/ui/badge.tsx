import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "positive" | "attention" | "critical";

const tones: Record<Tone, string> = {
  neutral: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted-strong)]",
  primary: "border-transparent bg-[var(--primary-soft)] text-[var(--primary-strong)]",
  positive: "border-transparent bg-[var(--positive-soft)] text-[var(--positive)]",
  attention: "border-transparent bg-[var(--attention-soft)] text-[var(--attention)]",
  critical: "border-transparent bg-[var(--critical-soft)] text-[var(--critical)]",
};

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold",
        tone && tones[tone],
        className,
      )}
      {...props}
    />
  );
}
