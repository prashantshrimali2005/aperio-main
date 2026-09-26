"use client";

import { useState } from "react";
import { Check, CircleAlert, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { RoleSummary } from "@/lib/types";

const selectClass =
  "h-11 w-full rounded-[10px] border bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_16%,transparent)]";

export function ProfileEditor({ profile, roles }: { profile: Record<string, unknown>; roles: RoleSummary[] }) {
  const [state, setState] = useState(profile);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function field(name: string, value: unknown) {
    setState((prev) => ({ ...prev, [name]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const response = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: state.fullName,
          headline: state.headline || null,
          currentStatus: state.currentStatus || null,
          bio: state.bio || null,
          location: state.location || null,
          yearsExperience: Number(state.yearsExperience) || 0,
          targetRoleId: state.targetRoleId || null,
          targetLevel: state.targetLevel || null,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error?.message || "Could not save profile.");
      setResult({ ok: true, text: "Profile saved." });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Could not save profile." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_.72fr]">
      <section className="rounded-[18px] border bg-[var(--surface)] p-6 sm:p-8">
        <h2 className="text-lg font-semibold">Professional profile</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Add context that a resume may not communicate clearly.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label>
            <span className="mb-2 block text-sm font-medium">Full name</span>
            <Input value={String(state.fullName || "")} onChange={(e) => field("fullName", e.target.value)} autoComplete="name" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium">Location</span>
            <Input value={String(state.location || "")} onChange={(e) => field("location", e.target.value)} placeholder="City, country" autoComplete="address-level2" />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-medium">Professional headline</span>
            <Input value={String(state.headline || "")} onChange={(e) => field("headline", e.target.value)} placeholder="What you do and where you create value" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium">Current situation</span>
            <select value={String(state.currentStatus || "")} onChange={(e) => field("currentStatus", e.target.value)} className={selectClass}>
              <option value="">Select</option>
              <option value="student">Student</option>
              <option value="fresher">Fresher</option>
              <option value="professional">Working professional</option>
              <option value="career_switcher">Career switcher</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium">Years of experience</span>
            <Input type="number" min="0" max="60" step="0.5" value={String(state.yearsExperience || 0)} onChange={(e) => field("yearsExperience", e.target.value)} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-medium">Professional summary</span>
            <Textarea value={String(state.bio || "")} onChange={(e) => field("bio", e.target.value)} placeholder="Summarize your experience, strengths, and the kind of problems you solve." />
          </label>
        </div>
      </section>

      <aside className="space-y-6">
        <section className="rounded-[18px] border bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold">Career target</h2>
          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-medium">Role</span>
            <select value={String(state.targetRoleId || "")} onChange={(e) => field("targetRoleId", e.target.value)} className={selectClass}>
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.title}</option>
              ))}
            </select>
          </label>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium">Level</span>
            <select value={String(state.targetLevel || "")} onChange={(e) => field("targetLevel", e.target.value)} className={selectClass}>
              <option value="">Select level</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </select>
          </label>
        </section>

        <section className="rounded-[18px] bg-[var(--primary-soft)] p-6">
          <p className="text-sm font-semibold">AI inference stays editable</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Use the Skill Profile screen to correct any inferred level. Verified corrections are used in later analyses.</p>
        </section>

        <Button className="w-full" size="lg" loading={saving}>
          {!saving && <Save size={16} />}
          {saving ? "Saving…" : "Save profile"}
        </Button>

        {result && (
          <p
            role={result.ok ? "status" : "alert"}
            className={cn("flex items-center gap-2 text-sm", result.ok ? "text-[var(--muted-strong)]" : "text-[var(--critical)]")}
          >
            {result.ok ? <Check size={15} className="text-[var(--positive)]" /> : <CircleAlert size={15} className="text-[var(--critical)]" />}
            {result.text}
          </p>
        )}
      </aside>
    </form>
  );
}
