"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Compass, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoleSummary } from "@/lib/types";

const statusOptions = [
  ["student", "Student"],
  ["fresher", "Fresher"],
  ["professional", "Working professional"],
  ["career_switcher", "Career switcher"],
] as const;

const levels = ["junior", "mid", "senior"] as const;

export function OnboardingForm({ roles }: { roles: RoleSummary[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("professional");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [level, setLevel] = useState<string>("mid");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentStatus: status,
          targetRoleId: roleId,
          targetLevel: level,
          onboardingCompleted: true,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Could not save your profile.");
      router.push("/analyze");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <section className="rounded-[20px] border bg-[var(--surface)] p-6 sm:p-8">
        <span className="grid size-11 place-items-center rounded-[13px] bg-[var(--primary-soft)] text-[var(--primary)]">
          <UserRound size={20} />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]">Step 1</p>
        <h2 className="mt-2 text-xl font-semibold">Where are you now?</h2>

        <fieldset className="mt-5">
          <legend className="sr-only">Your current status</legend>
          <div className="grid gap-2">
            {statusOptions.map(([value, label]) => {
              const active = status === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatus(value)}
                  className={cn(
                    "flex h-12 items-center rounded-[11px] border px-4 text-left text-sm font-medium transition-colors",
                    active
                      ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]",
                  )}
                >
                  <span
                    className={cn(
                      "mr-3 grid size-5 place-items-center rounded-full border transition-colors",
                      active && "border-[var(--primary)] bg-[var(--primary)] text-white",
                    )}
                  >
                    {active && <Check size={12} />}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className="rounded-[20px] border bg-[var(--surface)] p-6 sm:p-8">
        <span className="grid size-11 place-items-center rounded-[13px] bg-[var(--attention-soft)] text-[var(--attention)]">
          <Compass size={20} />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]">Step 2</p>
        <h2 className="mt-2 text-xl font-semibold">Where do you want to go?</h2>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-medium">Target role</span>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="h-12 w-full rounded-[11px] border bg-[var(--surface-elevated)] px-4 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_16%,transparent)]"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.title}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium">Target level</legend>
          <div role="radiogroup" aria-label="Target level" className="grid grid-cols-3 rounded-[12px] bg-[var(--surface-muted)] p-1">
            {levels.map((item) => {
              const active = level === item;
              return (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setLevel(item)}
                  className={cn(
                    "h-10 rounded-[9px] text-sm font-semibold capitalize transition-colors",
                    active ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="mt-4 text-sm text-[var(--critical)]">
            {error}
          </p>
        )}

        <Button onClick={save} loading={saving} disabled={!roleId} size="lg" className="mt-7 w-full">
          {saving ? "Saving…" : "Continue to your analysis"}
          {!saving && <ArrowRight size={16} />}
        </Button>
      </section>
    </div>
  );
}
