import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ size = 18, className, label = "Loading" }: { size?: number; className?: string; label?: string }) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex text-[var(--muted)]", className)}>
      <LoaderCircle size={size} className="animate-spin" />
      <span className="sr-only">{label}…</span>
    </span>
  );
}
