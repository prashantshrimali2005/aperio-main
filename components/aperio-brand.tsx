import Link from "next/link";
import { cn } from "@/lib/utils";

export function AperioBrand({ subtitle = true, className, href = "/" }: { subtitle?: boolean; className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group flex items-center gap-3", className)} aria-label="Aperio home">
      <span className="relative grid size-9 shrink-0 place-items-center" aria-hidden="true">
        <span className="absolute left-[8px] top-[4px] h-8 w-[7px] rotate-[28deg] rounded-sm bg-gradient-to-b from-[#8478ff] to-[#4338ca]" />
        <span className="absolute right-[8px] top-[4px] h-8 w-[7px] -rotate-[28deg] rounded-sm bg-gradient-to-b from-[#6157f0] to-[#3127c8]" />
        <span className="absolute bottom-[8px] h-[6px] w-[14px] rounded-full bg-[var(--surface)] transition-colors" />
      </span>
      <span className="min-w-0"><span className="block text-[17px] font-bold tracking-[.115em]">APERIO</span>{subtitle && <span className="mt-0.5 block text-[10px] font-medium text-[var(--muted)]">Skill-Gap Analyzer</span>}</span>
    </Link>
  );
}
