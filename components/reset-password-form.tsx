"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password.length < 10) {
      setError("Use at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Unable to reset your password.");
      setDone(true);
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset your password.");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-[11px] border border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-3.5 py-3.5 text-[13px] leading-5">
          <CheckCircle2 size={18} className="mt-px shrink-0 text-[var(--primary)]" />
          <div>
            <p className="font-semibold">Password updated</p>
            <p className="mt-1 text-[var(--muted-strong)]">
              Taking you to sign in&hellip; Use your new password from here on.
            </p>
          </div>
        </div>
        <p className="text-center text-[13px] text-[var(--muted)]">
          <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
            Go to sign in now
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
          <span className="mb-1.5 block text-[13px] font-medium">New password</span>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            placeholder="At least 10 characters"
            disabled={loading}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Confirm new password</span>
          <Input
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            placeholder="Re-enter the password"
            disabled={loading}
          />
        </label>

        <Button className="mt-1 w-full" size="lg" loading={loading}>
          Update password
          {!loading && <ArrowRight size={16} />}
        </Button>

        <p className="pt-1 text-center text-[13px] text-[var(--muted)]">
          <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
