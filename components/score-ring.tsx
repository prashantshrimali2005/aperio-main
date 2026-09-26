import { cn } from "@/lib/utils";

export function ScoreRing({ score, size = "lg" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = score >= 75 ? "var(--positive)" : score >= 55 ? "var(--primary)" : "var(--attention)";
  return <div className={cn("relative grid shrink-0 place-items-center rounded-full", size === "lg" ? "size-36 sm:size-44" : size === "md" ? "size-28 sm:size-32" : "size-16", "bg-[conic-gradient(var(--ring-color)_calc(var(--score)*1%),var(--surface-muted)_0)]")} style={{ "--score": score, "--ring-color": color } as React.CSSProperties} aria-label={`${score}% match`} role="img">
    <div className={cn("grid place-items-center rounded-full bg-[var(--surface)]", size === "lg" ? "size-[calc(100%-12px)]" : size === "md" ? "size-[calc(100%-10px)]" : "size-[calc(100%-7px)]")}>
      {size !== "sm" ? <div className="text-center"><div className={cn("font-semibold tracking-[-.055em]", size === "lg" ? "text-4xl" : "text-2xl")}>{score}%</div><div className="mt-1 text-[9px] font-semibold uppercase tracking-[.12em] text-[var(--muted)]">Match</div></div> : <span className="text-sm font-bold">{score}</span>}
    </div>
  </div>;
}
