import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AperioBrand } from "@/components/aperio-brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[var(--background)] px-6">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center"><AperioBrand href="/" subtitle={false} /></div>
        <p className="aperio-eyebrow mt-10">Error 404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">This page isn’t here.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          The link may be outdated or the page may have moved. Let’s get you back to your workspace.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button asChild><Link href="/overview"><ArrowLeft size={15} /> Back to overview</Link></Button>
          <Button asChild variant="secondary"><Link href="/">Home</Link></Button>
        </div>
      </div>
    </main>
  );
}
