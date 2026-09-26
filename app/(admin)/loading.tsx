import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-7 w-52" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 w-full rounded-[16px]" />
        <Skeleton className="h-32 w-full rounded-[16px]" />
        <Skeleton className="h-32 w-full rounded-[16px]" />
      </div>
      <Skeleton className="mt-4 h-80 w-full rounded-[16px]" />
    </div>
  );
}
