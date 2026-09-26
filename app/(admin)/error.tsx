"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[aperio] admin error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md rounded-[16px] border bg-[var(--surface)] p-8 text-center shadow-[var(--shadow)]">
      <p className="aperio-eyebrow">Admin error</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">This view didn’t load.</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Try again, or head back to the admin overview.</p>
      {error.digest && <p className="mt-3 font-mono text-[11px] text-[var(--muted)]">Reference: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}><RotateCcw size={15} /> Try again</Button>
        <Button asChild variant="secondary"><Link href="/admin">Admin overview</Link></Button>
      </div>
    </div>
  );
}
