"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { AperioBrand } from "@/components/aperio-brand";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[aperio] route error:", error);
  }, [error]);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[var(--background)] px-6">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center"><AperioBrand href="/" subtitle={false} /></div>
        <p className="aperio-eyebrow mt-10">Something broke</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">We hit an unexpected error.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          This one’s on us. Try again — if it keeps happening, come back in a few minutes.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-[var(--muted)]">Reference: {error.digest}</p>
        )}
        <div className="mt-7 flex justify-center">
          <Button onClick={reset}><RotateCcw size={15} /> Try again</Button>
        </div>
      </div>
    </main>
  );
}
