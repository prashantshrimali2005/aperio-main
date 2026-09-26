"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BrainCircuit,
  Check,
  ChevronDown,
  Eye,
  FileCheck,
  FileSearch,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExperienceLevel, RoleSummary } from "@/lib/types";

export type Resume = {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: string;
  documentType?: string | null;
  validationConfidence?: number | string | null;
  processingProvider?: string | null;
  candidateName?: string | null;
  skillsDetected?: number;
  warnings?: string[];
  createdAt: string;
};

const analysisStages = [
  "Understanding your experience",
  "Mapping demonstrated skills",
  "Comparing role expectations",
  "Preparing your personal roadmap",
];

const uploadStages = [
  { label: "Verifying file and document structure", icon: Fingerprint },
  { label: "Reading text, layout, and visual signals", icon: ScanLine },
  { label: "Extracting skills and supporting evidence", icon: BrainCircuit },
];

function confidenceLabel(value?: number | string | null) {
  const score = Number(value ?? 0);
  if (!score) return "Verified resume";
  return `${Math.round(score * 100)}% document confidence`;
}

export function AnalysisWorkbench({ roles, initialResumes, initialRoleId }: { roles: RoleSummary[]; initialResumes: Resume[]; initialRoleId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [roleId, setRoleId] = useState(initialRoleId && roles.some((role) => role.id === initialRoleId) ? initialRoleId : roles[0]?.id ?? "");
  const [level, setLevel] = useState<ExperienceLevel>("mid");
  const [resumes, setResumes] = useState(initialResumes);
  const [resumeId, setResumeId] = useState(initialResumes[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!analyzing) return;
    const timer = window.setInterval(() => setStage((value) => Math.min(analysisStages.length - 1, value + 1)), 1400);
    return () => window.clearInterval(timer);
  }, [analyzing]);

  useEffect(() => {
    if (!uploading) return;
    const timer = window.setInterval(() => setUploadStage((value) => (value + 1) % uploadStages.length), 1600);
    return () => window.clearInterval(timer);
  }, [uploading]);

  const MAX_BYTES = 5 * 1024 * 1024;
  const ALLOWED = /\.(pdf|docx|jpe?g|png|webp)$/i;

  async function upload(file?: File) {
    if (!file) return;
    if (!ALLOWED.test(file.name)) {
      setError("Unsupported file type. Use PDF, DOCX, JPG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`);
      return;
    }
    setUploading(true);
    setUploadStage(0);
    setError("");
    try {
      const data = new FormData();
      data.set("file", file);
      const response = await fetch("/api/v1/resumes", { method: "POST", body: data });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Resume could not be processed.");
      const uploaded = { ...json.data, createdAt: new Date().toISOString() } as Resume;
      setResumes((items) => [uploaded, ...items]);
      setResumeId(uploaded.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume could not be processed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function analyze() {
    if (!roleId) {
      setError("Choose a target role.");
      return;
    }
    setAnalyzing(true);
    setStage(0);
    setError("");
    try {
      const response = await fetch("/api/v1/analyses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleId, experienceLevel: level, resumeId: resumeId || null }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Analysis failed.");
      router.push(`/history/${json.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setAnalyzing(false);
    }
  }

  if (analyzing) {
    return (
      <section className="relative mx-auto max-w-3xl overflow-hidden rounded-[24px] border bg-[var(--surface)] p-8 shadow-[var(--shadow)] sm:p-12">
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] blur-3xl" />
        <div className="relative">
          <div className="mx-auto grid size-14 place-items-center rounded-[16px] bg-[var(--primary-soft)] text-[var(--primary)]"><Sparkles size={24} className="animate-pulse" /></div>
          <p className="mt-6 text-center text-xs font-semibold uppercase tracking-[.16em] text-[var(--primary)]">Aperio intelligence</p>
          <h2 className="mt-2 text-center text-2xl font-semibold tracking-[-.03em]">Building your evidence-based analysis</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm leading-6 text-[var(--muted)]">Your match score comes from stored role requirements. Gemini turns the verified evidence into guidance tailored to your profile.</p>
          <div aria-live="polite" className="mx-auto mt-9 max-w-md space-y-3">
            {analysisStages.map((label, index) => (
              <div key={label} className={cn("flex items-center gap-3 rounded-[12px] border px-4 py-3 text-sm transition-colors", index === stage ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--foreground)]" : "text-[var(--muted)]")}>
                <span className={cn("grid size-6 place-items-center rounded-full", index < stage ? "bg-[var(--positive)] text-white" : index === stage ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-muted)]")}>
                  {index < stage ? <Check size={13} /> : index === stage ? <LoaderCircle size={13} className="animate-spin" /> : <span className="text-[10px]">{index + 1}</span>}
                </span>
                {label}
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-[var(--muted)]">No fabricated percentage or guaranteed outcome.</p>
        </div>
      </section>
    );
  }

  const selected = resumes.find((resume) => resume.id === resumeId);
  const selectedRole = roles.find((role) => role.id === roleId);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
      <section className="relative overflow-hidden rounded-[22px] border bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8">
        <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_68%)]" />
        <div className="relative flex items-start justify-between gap-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[11px] bg-[var(--primary-soft)] text-[var(--primary)]"><Search size={18} /></span>
            <div><p className="text-xs font-semibold uppercase tracking-[.13em] text-[var(--muted)]">01 · Target</p><h2 className="mt-1 text-lg font-semibold">Choose where you’re heading</h2></div>
          </div>
          <span className="hidden rounded-[8px] border bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] sm:block">Role intelligence</span>
        </div>

        <label className="relative mt-8 block">
          <span className="mb-2 block text-sm font-medium">Career role</span>
          <div className="relative">
            <select value={roleId} onChange={(event) => setRoleId(event.target.value)} className="h-13 w-full appearance-none rounded-[12px] border bg-[var(--surface-elevated)] px-4 pr-11 text-sm font-semibold outline-none transition focus:border-[var(--primary)]">
              {roles.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}
            </select>
            <ChevronDown size={17} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          </div>
        </label>

        <fieldset className="relative mt-6">
          <legend className="mb-2 text-sm font-medium">Experience target</legend>
          <div className="grid grid-cols-3 rounded-[13px] border bg-[var(--surface-muted)] p-1">
            {(["junior", "mid", "senior"] as const).map((item) => (
              <button type="button" key={item} onClick={() => setLevel(item)} aria-pressed={level === item} className={cn("h-10 rounded-[9px] text-sm font-semibold capitalize transition", level === item ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]")}>{item}</button>
            ))}
          </div>
        </fieldset>

        <div className="relative mt-7 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[13px] bg-[var(--surface-elevated)] p-4"><Eye size={16} className="text-[var(--positive)]" /><p className="mt-3 text-sm font-semibold">Evidence over assumptions</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Skills are tied to visible resume or profile evidence.</p></div>
          <div className="rounded-[13px] bg-[var(--surface-elevated)] p-4"><ShieldCheck size={16} className="text-[var(--primary)]" /><p className="mt-3 text-sm font-semibold">Constructive language</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Missing means “not demonstrated,” never “you don’t know it.”</p></div>
        </div>
        {selectedRole && <p className="relative mt-5 text-xs text-[var(--muted)]">Assessing your profile against <span className="font-semibold text-[var(--foreground)]">{selectedRole.title}</span> requirements for a <span className="font-semibold capitalize text-[var(--foreground)]">{level}</span> target.</p>}
      </section>

      <section className="rounded-[22px] border bg-[var(--surface)] p-6 sm:p-8">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[11px] bg-[var(--attention-soft)] text-[var(--attention)]"><FileSearch size={18} /></span><div><p className="text-xs font-semibold uppercase tracking-[.13em] text-[var(--muted)]">02 · Evidence</p><h2 className="mt-1 text-lg font-semibold">Add your current resume</h2></div></div>
        <input ref={inputRef} className="sr-only" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0])} />

        {uploading ? (
          <div aria-live="polite" className="mt-7 overflow-hidden rounded-[16px] border border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] bg-[var(--surface-elevated)]">
            <div className="relative h-24 overflow-hidden border-b bg-[var(--surface-muted)]"><div className="absolute inset-x-6 top-5 h-14 rounded-[7px] border bg-[var(--surface)] opacity-70" /><div className="absolute inset-x-0 top-1/2 h-px bg-[var(--primary)] shadow-[0_0_16px_var(--primary)] motion-safe:animate-pulse" /><ScanLine className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--primary)]" size={24} /></div>
            <div className="p-4"><p className="text-sm font-semibold">Gemini is verifying your document</p><div className="mt-3 space-y-2">{uploadStages.map(({ label, icon: Icon }, index) => <div key={label} className={cn("flex items-center gap-2 text-xs", index === uploadStage ? "text-[var(--foreground)]" : "text-[var(--muted)]")}>{index === uploadStage ? <LoaderCircle size={14} className="animate-spin text-[var(--primary)]" /> : <Icon size={14} />}{label}</div>)}</div></div>
          </div>
        ) : selected ? (
          <div className="mt-7 rounded-[16px] border border-[color-mix(in_srgb,var(--positive)_35%,var(--border))] bg-[var(--positive-soft)] p-4">
            <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[var(--surface)] text-[var(--positive)]"><FileCheck size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="max-w-full truncate text-sm font-semibold">{selected.filename}</p><span className="rounded-[6px] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.08em] text-[var(--positive)]">Gemini verified</span></div><p className="mt-1 text-xs text-[var(--muted)]">{selected.candidateName || "Resume candidate"} · {(selected.fileSize / 1024).toFixed(0)} KB</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-[var(--muted-strong)]"><span>{confidenceLabel(selected.validationConfidence)}</span>{typeof selected.skillsDetected === "number" && <span>{selected.skillsDetected} skill signals found</span>}</div></div><button type="button" onClick={() => setResumeId("")} className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)]" aria-label="Remove selected resume"><X size={15} /></button></div>
            <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 text-xs font-semibold text-[var(--primary)]">Replace resume</button>
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); setDragActive(false); upload(event.dataTransfer.files?.[0]); }} className={cn("group mt-7 flex w-full flex-col items-center rounded-[16px] border border-dashed px-5 py-8 text-center transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]", dragActive ? "border-[var(--primary)] bg-[var(--primary-soft)] ring-2 ring-[color-mix(in_srgb,var(--primary)_20%,transparent)]" : "border-[var(--border-strong)] bg-[var(--surface-elevated)]")}><span className="grid size-11 place-items-center rounded-[12px] bg-[var(--primary-soft)] text-[var(--primary)] transition group-hover:bg-[var(--surface)]"><UploadCloud size={20} /></span><span className="mt-4 text-sm font-semibold">Drop your resume here</span><span className="mt-1 text-xs text-[var(--muted)]">or click to browse · PDF, DOCX, JPG, PNG, WebP · 5 MB max</span><span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted-strong)]"><ScanLine size={13} />Scans and image-based resumes supported</span></button>
        )}

        {resumes.length > 1 && !uploading && <label className="mt-4 block"><span className="mb-2 block text-xs font-medium text-[var(--muted)]">Previously verified resumes</span><select value={resumeId} onChange={(event) => setResumeId(event.target.value)} className="h-10 w-full rounded-[9px] border bg-[var(--surface)] px-3 text-xs"><option value="">Use profile only</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.filename}</option>)}</select></label>}

        <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--border)]" />ready to assess<span className="h-px flex-1 bg-[var(--border)]" /></div>
        <Button onClick={analyze} size="lg" className="w-full" disabled={!roleId || uploading}><Sparkles size={17} />Analyze skill gap</Button>
        <div className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-[var(--muted)]"><LockKeyhole size={13} className="mt-0.5 shrink-0" /><p>Your file is sent securely to Gemini for OCR and resume verification. Aperio stores extracted evidence and metadata, never a public resume URL.</p></div>
        {error && <div role="alert" className="mt-4 rounded-[10px] border border-[color-mix(in_srgb,var(--critical)_25%,var(--border))] bg-[var(--critical-soft)] p-3 text-sm text-[var(--critical)]">{error}</div>}
      </section>
    </div>
  );
}
