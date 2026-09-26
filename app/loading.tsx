import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[var(--background)]">
      <Spinner size={26} label="Loading Aperio" />
    </div>
  );
}
