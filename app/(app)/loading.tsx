import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="aperio-page" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="mt-7 grid gap-4 lg:grid-cols-[1.12fr_.88fr]">
        <Skeleton className="h-72 w-full rounded-[16px]" />
        <Skeleton className="h-72 w-full rounded-[16px]" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 w-full rounded-[16px]" />
        <Skeleton className="h-40 w-full rounded-[16px]" />
        <Skeleton className="h-40 w-full rounded-[16px]" />
      </div>
    </div>
  );
}
