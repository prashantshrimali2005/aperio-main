"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[aperio] workspace error:", error);
  }, [error]);

  return (
    <div className="aperio-page">
      <div className="mx-auto max-w-md rounded-[16px] border bg-[var(--surface)] p-8 text-center shadow-[var(--shadow)]">
        <p className="aperio-eyebrow">Something went wrong</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">This section didn’t load.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          The rest of your workspace is fine. Try reloading this section.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-[var(--muted)]">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}><RotateCcw size={15} /> Try again</Button>
          <Button asChild variant="secondary"><Link href="/overview">Go to overview</Link></Button>
        </div>
      </div>
    </div>
  );
}
