"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, LoaderCircle, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SetRow = Record<string, unknown>;
type Item = { id: string; prompt: string; options: string[]; correctIndex: number; explanation: string; position: number };
type Suggest = { topic: string; niche: string; level: string; rationale: string };

export function QuestionSetManager({ initial, embedded }: { initial: SetRow[]; embedded?: boolean }) {
  const [sets, setSets] = useState(initial);
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [level, setLevel] = useState("mid");
  const [count, setCount] = useState(10);
  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState<"" | "generate" | "suggest">("");
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");
  const [preview, setPreview] = useState<Record<string, Item[]>>({});
  const [ideas, setIdeas] = useState<Suggest[]>([]);

  function applyIdea(s: Suggest) {
    setTopic(s.topic);
    setNiche(s.niche);
    setLevel(s.level);
  }

  async function autofill() {
    setBusy("suggest");
    setError("");
    try {
      const res = await fetch("/api/v1/admin/question-sets/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ niche: niche.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not suggest.");
      const list = json.data.topics as Suggest[];
      setIdeas(list);
      if (list[0]) applyIdea(list[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not suggest.");
    } finally {
      setBusy("");
    }
  }

  async function generate() {
    if (!topic.trim()) return;
    setBusy("generate");
    setError("");
    try {
      const res = await fetch("/api/v1/admin/question-sets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), niche: niche.trim() || undefined, level, count, priceInr: price }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Generation failed.");
      const set = json.data as { id: string; questions: Item[] } & Record<string, unknown>;
      setSets((s) => [{ ...set, questionCount: set.questions?.length ?? 0, attempts: 0 }, ...s]);
      setPreview((p) => ({ ...p, [set.id]: set.questions ?? [] }));
      setOpenId(set.id);
      setTopic("");
      setIdeas((list) => list.filter((x) => x.topic !== topic.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy("");
    }
  }

  async function toggleOpen(id: string) {
    if (openId === id) return setOpenId("");
    setOpenId(id);
    if (!preview[id]) {
      const res = await fetch(`/api/v1/admin/question-sets/${id}`);
      const json = await res.json();
      if (res.ok) setPreview((p) => ({ ...p, [id]: json.data.questions as Item[] }));
    }
  }

  async function setPublished(id: string, published: boolean) {
    setSets((s) => s.map((x) => (x.id === id ? { ...x, published } : x)));
    await fetch(`/api/v1/admin/question-sets/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ published }),
    });
  }

  async function savePrice(id: string, priceInr: number) {
    const p = Math.max(0, Math.round(priceInr || 0));
    setSets((s) => s.map((x) => (x.id === id ? { ...x, priceInr: p } : x)));
    await fetch(`/api/v1/admin/question-sets/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priceInr: p }),
    });
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”? This removes it from every user's Practice page and can't be undone.`)) return;
    const prev = sets;
    setSets((s) => s.filter((x) => x.id !== id));
    const res = await fetch(`/api/v1/admin/question-sets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setSets(prev);
      setError("Couldn’t delete that set. Try again.");
    }
  }

  const byNiche = sets.reduce<Record<string, SetRow[]>>((acc, s) => {
    const k = String(s.niche || "General");
    (acc[k] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Practice sets</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Generate MCQ sets with Gemini across niches. Published sets appear on every user&apos;s Practice page.</p>
        </div>
      )}

      <div className="rounded-[16px] border border-[var(--primary)]/30 bg-[var(--primary-soft)]/40 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium">Topic</span>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. React rendering & reconciliation" />
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium">Niche</span>
            <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. Frontend" />
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium">Level</span>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="h-10 w-full rounded-[9px] border bg-[var(--surface-elevated)] px-3 text-sm">
              {["junior", "mid", "senior", "all"].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium">Questions</span>
            <Input type="number" min={5} max={25} value={count} onChange={(e) => setCount(Math.max(5, Math.min(25, Number(e.target.value) || 10)))} />
          </label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium">Price ₹ — 0 = free (no payment)</span>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(Math.max(0, Math.round(Number(e.target.value) || 0)))} placeholder="0" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={autofill} disabled={Boolean(busy)}>
            {busy === "suggest" ? <LoaderCircle size={13} className="animate-spin" /> : <Wand2 size={13} />}Autofill fields
          </Button>
          <Button size="sm" onClick={generate} disabled={Boolean(busy) || !topic.trim()} className="ml-auto">
            {busy === "generate" ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}Generate set
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">Autofill picks a topic you don&apos;t already have and fills the fields. A niche + topic that already exists is refused.</p>
        {error && <p role="alert" className="mt-1.5 text-xs text-[var(--critical)]">{error}</p>}
        {ideas.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {ideas.map((s, i) => (
              <button key={i} type="button" onClick={() => applyIdea(s)} className="block w-full rounded-[9px] border bg-[var(--surface)] p-2 text-left text-[11px]">
                <span className="font-medium">{s.topic}</span> <span className="text-[var(--muted)]">· {s.niche} · {s.level} — {s.rationale}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {Object.entries(byNiche).map(([n, rows]) => (
        <section key={n}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{n} · {rows.length}</h2>
          <div className="overflow-hidden rounded-[14px] border bg-[var(--surface)]">
            {rows.map((s) => {
              const id = String(s.id);
              const open = openId === id;
              return (
                <div key={id} className="border-b last:border-0">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button type="button" onClick={() => toggleOpen(id)} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} questions in ${String(s.title)}`} className="text-[var(--muted)]">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{String(s.title)}</p>
                      <p className="text-xs text-[var(--muted)]">{String(s.level)} · {Number(s.questionCount)} questions · {Number(s.attempts ?? 0)} attempts</p>
                    </div>
                    <label className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
                      ₹<input
                        type="number"
                        min={0}
                        defaultValue={Number(s.priceInr ?? 0)}
                        onBlur={(e) => savePrice(id, Number(e.target.value))}
                        className="h-7 w-16 rounded-[7px] border bg-[var(--surface-elevated)] px-1.5 text-xs"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium">
                      <input type="checkbox" className="size-3.5 accent-[var(--primary)]" checked={Boolean(s.published)} onChange={(e) => setPublished(id, e.target.checked)} />
                      {s.published ? "live" : "hidden"}
                    </label>
                    <button type="button" onClick={() => remove(id, String(s.title))} aria-label={`Delete ${String(s.title)}`} className="grid size-8 place-items-center rounded-[8px] text-[var(--muted)] hover:text-[var(--critical)]"><Trash2 size={14} /></button>
                  </div>
                  {open && (
                    <div className="space-y-3 border-t bg-[var(--surface-elevated)] px-4 py-3">
                      {(preview[id] ?? []).map((q, i) => (
                        <div key={q.id} className="text-xs">
                          <p className="font-medium">{i + 1}. {q.prompt}</p>
                          <ul className="mt-1 space-y-0.5">
                            {q.options.map((o, j) => (
                              <li key={j} className={cn("pl-3", j === q.correctIndex ? "font-semibold text-[var(--positive)]" : "text-[var(--muted-strong)]")}>
                                {String.fromCharCode(65 + j)}. {o}{j === q.correctIndex ? "  ✓" : ""}
                              </li>
                            ))}
                          </ul>
                          {q.explanation && <p className="mt-1 pl-3 text-[var(--muted)]">{q.explanation}</p>}
                        </div>
                      ))}
                      {!preview[id]?.length && <p className="text-xs text-[var(--muted)]">Loading…</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {!sets.length && <p className="rounded-[14px] border bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">No sets yet. Generate one above.</p>}
    </div>
  );
}
