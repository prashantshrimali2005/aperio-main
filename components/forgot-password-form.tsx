"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const email = String(new FormData(event.currentTarget).get("email") || "").trim();
    try {
      const response = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Unable to continue.");
      setSentTo(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue.");
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-[11px] border border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-3.5 py-3.5 text-[13px] leading-5">
          <MailCheck size={18} className="mt-px shrink-0 text-[var(--primary)]" />
          <div>
            <p className="font-semibold">Check your inbox</p>
            <p className="mt-1 text-[var(--muted-strong)]">
              If an account exists for <span className="font-medium">{sentTo}</span>, a reset link is on its way. It
              expires in 60 minutes.
            </p>
          </div>
        </div>
        <p className="text-center text-[13px] text-[var(--muted)]">
          Didn&rsquo;t get it? Check spam, or{" "}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="font-semibold text-[var(--primary)] hover:underline"
          >
            try again
          </button>
          .
        </p>
        <p className="text-center text-[13px] text-[var(--muted)]">
          <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-[11px] border border-[color-mix(in_srgb,var(--critical)_35%,var(--border))] bg-[var(--critical-soft)] px-3.5 py-3 text-[13px] leading-5 text-[var(--critical)]"
        >
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Email</span>
          <Input name="email" type="email" autoComplete="email" required placeholder="you@example.com" disabled={loading} />
        </label>

        <Button className="mt-1 w-full" size="lg" loading={loading}>
          Send reset link
          {!loading && <ArrowRight size={16} />}
        </Button>

        <p className="pt-1 text-center text-[13px] text-[var(--muted)]">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
