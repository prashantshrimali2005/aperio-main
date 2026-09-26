"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, BarChart3, Check, CheckCheck, Download, LoaderCircle, Maximize2, MessageCircle, Paperclip, Play, Plus, Search, Send, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Thread = {
  id: string;
  channel: "telegram_userbot" | "telegram_bot" | "whatsapp";
  peerId: string;
  peerName: string | null;
  peerUsername: string | null;
  userName: string | null;
  userEmail: string | null;
  lastMessageAt: string | null;
  lastPreview: string | null;
  lastDirection: string | null;
  unreadCount: number;
};
type Message = {
  id: string;
  direction: "in" | "out";
  kind: string;
  text: string | null;
  mediaId: string | null;
  mediaMime: string | null;
  mediaName: string | null;
  mediaSize: number | null;
  senderName: string | null;
  status: string;
  createdAt: string;
  pending?: boolean;
};

const channelDot: Record<string, string> = { telegram_userbot: "#229ED9", telegram_bot: "#229ED9", whatsapp: "#25D366" };

function timeLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

type Preview = { src: string; kind: "image" | "video"; name: string };

// message kinds that actually carry a downloadable/previewable attachment
const MEDIA_KINDS = new Set(["image", "sticker", "video", "audio", "voice", "file"]);

function renderStatusIcon(m: Message) {
  // A "pending" row older than 90s means the send never confirmed — show it as
  // stalled instead of spinning forever (the server also reaps these).
  const stalled = m.status === "pending" && Date.now() - new Date(m.createdAt).getTime() > 90_000;
  if (m.status === "failed" || stalled) return <AlertCircle size={11} />;
  if (m.status === "pending") return <LoaderCircle size={10} className="animate-spin" />;
  if (m.status === "read" || m.status === "delivered") return <CheckCheck size={11} />;
  return <Check size={11} />;
}

function MediaBubble({ message, onOpen }: { message: Message; onOpen: (p: Preview) => void }) {
  const src = `/api/v1/admin/chat/media/${message.id}`;
  const name = message.mediaName || `${message.kind}-${message.id.slice(0, 6)}`;

  if (message.kind === "image" || message.kind === "sticker") {
    return (
      <button type="button" onClick={() => onOpen({ src, kind: "image", name })} className="group relative mt-1 block overflow-hidden rounded-[10px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} className="max-h-72 max-w-full" loading="lazy" />
        <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100"><Maximize2 size={12} /></span>
      </button>
    );
  }
  if (message.kind === "video") {
    return (
      <button type="button" onClick={() => onOpen({ src, kind: "video", name })} className="group relative mt-1 block overflow-hidden rounded-[10px]">
        <video src={src} className="max-h-72 max-w-full" preload="metadata" muted />
        <span className="absolute inset-0 grid place-items-center bg-black/25"><span className="grid size-10 place-items-center rounded-full bg-black/60 text-white"><Play size={18} /></span></span>
      </button>
    );
  }
  if (message.kind === "audio" || message.kind === "voice") {
    return <audio src={src} controls className="mt-1 w-56" preload="none" />;
  }
  return (
    <a href={`${src}?download=1`} download={name} className="mt-1 flex items-center gap-2 rounded-[10px] border bg-[var(--surface)] px-3 py-2 text-xs font-medium hover:border-[var(--primary)]">
      <Paperclip size={13} className="shrink-0" />
      <span className="min-w-0 truncate">{name}</span>
      {message.mediaSize ? <span className="shrink-0 text-[var(--muted)]">· {Math.round(message.mediaSize / 1024)} KB</span> : null}
      <Download size={13} className="ml-auto shrink-0 text-[var(--primary)]" />
    </a>
  );
}

function Lightbox({ preview, onClose }: { preview: Preview; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Preview: ${preview.name}`} className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 text-white">
        <span className="truncate text-sm font-medium">{preview.name}</span>
        <div className="flex items-center gap-2">
          <a
            href={`${preview.src}?download=1`}
            download={preview.name}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-[9px] bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
          >
            <Download size={14} />Download
          </a>
          <button type="button" onClick={onClose} aria-label="Close preview" className="grid size-8 place-items-center rounded-[9px] hover:bg-white/15"><X size={18} /></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        {preview.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.src} alt={preview.name} className="max-h-full max-w-full object-contain" />
        ) : (
          <video src={preview.src} controls autoPlay className="max-h-full max-w-full" />
        )}
      </div>
    </div>
  );
}

export function ChatWorkspace({ initialThreads, telegramReady, whatsappReady }: { initialThreads: Thread[]; telegramReady: boolean; whatsappReady: boolean }) {
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [channel, setChannel] = useState<"all" | "telegram" | "whatsapp">("all");
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<string | null>(initialThreads[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [contacts, setContacts] = useState<Array<{ userId: string; name: string; email: string; channels: Array<{ platform: string; address: string; handle: string | null }> }>>([]);
  const [newChannel, setNewChannel] = useState<"whatsapp" | "telegram_userbot">("whatsapp");
  const [newPeer, setNewPeer] = useState("");
  const [starting, setStarting] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState<string[]>(["", ""]);
  const [pollSending, setPollSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastIdRef = useRef<string | null>(null);
  const activeRef = useRef<string | null>(activeId);
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  const active = threads.find((t) => t.id === activeId) ?? null;

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/chat?channel=${channel}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      const json = await res.json();
      if (res.ok) setThreads(json.data.threads);
    } catch {
      /* keep */
    }
  }, [channel, q]);

  const loadMessages = useCallback(async (threadId: string, initial: boolean) => {
    try {
      const since = !initial && lastIdRef.current ? `&sinceId=${lastIdRef.current}` : "";
      const res = await fetch(`/api/v1/admin/chat/${threadId}?markRead=1${since}`);
      const json = await res.json();
      if (!res.ok) return;
      const incoming: Message[] = json.data.messages;
      if (initial) {
        setMessages(incoming);
      } else if (incoming.length) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          return [...prev.filter((m) => !m.pending), ...incoming.filter((m) => !ids.has(m.id))];
        });
      }
      if (incoming.length) lastIdRef.current = incoming[incoming.length - 1].id;
    } catch {
      /* keep */
    }
  }, []);

  async function openComposer() {
    setComposerOpen((v) => !v);
    if (!contacts.length) {
      const res = await fetch("/api/v1/admin/chat/contacts").then((r) => r.json()).catch(() => null);
      if (res?.data?.contacts) setContacts(res.data.contacts);
    }
  }

  async function sendPoll() {
    if (!activeId) return;
    setPollSending(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/admin/chat/${activeId}/poll`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: pollQ.trim(), options: pollOpts.map((o) => o.trim()).filter(Boolean) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Poll failed.");
      setPollOpen(false);
      setPollQ("");
      setPollOpts(["", ""]);
      await loadMessages(activeId, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Poll failed.");
    } finally {
      setPollSending(false);
    }
  }

  async function startThread(ch: "whatsapp" | "telegram_userbot", peer: string, name?: string) {
    if (!peer.trim()) return;
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/v1/admin/chat/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: ch, peer, name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not start the chat.");
      setComposerOpen(false);
      setNewPeer("");
      await loadThreads();
      setActiveId(json.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the chat.");
    } finally {
      setStarting(false);
    }
  }

  // thread list polling
  useEffect(() => {
    const tick = () => void loadThreads();
    tick();
    const t = setInterval(tick, 6000);
    return () => clearInterval(t);
  }, [loadThreads]);

  // active conversation: load + poll
  useEffect(() => {
    if (!activeId) return;
    lastIdRef.current = null;
    const reset = () => {
      setMessages([]);
      void loadMessages(activeId, true);
    };
    reset();
    const t = setInterval(() => {
      if (activeRef.current) void loadMessages(activeRef.current, false);
    }, 3000);
    return () => clearInterval(t);
  }, [activeId, loadMessages]);

  // autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(fileFromInput?: File) {
    if (!activeId || sending) return;
    const file = fileFromInput ?? null;
    if (!draft.trim() && !file) return;
    setSending(true);
    setError("");
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      direction: "out",
      kind: file ? (file.type.split("/")[0] === "image" ? "image" : file.type.split("/")[0] === "video" ? "video" : file.type.split("/")[0] === "audio" ? "audio" : "file") : "text",
      text: draft.trim() || null,
      mediaId: null,
      mediaMime: file?.type ?? null,
      mediaName: file?.name ?? null,
      mediaSize: file?.size ?? null,
      senderName: "You",
      status: "pending",
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    const text = draft;
    setDraft("");
    try {
      const body = new FormData();
      if (text.trim()) body.set("text", text.trim());
      if (file) body.set("file", file);
      const res = await fetch(`/api/v1/admin/chat/${activeId}`, { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Send failed.");
      await loadMessages(activeId, false);
      void loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...m, status: "failed" } : m)));
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Chat workspace</h1>
        <div className="flex gap-1 rounded-[10px] border bg-[var(--surface)] p-1 text-xs font-medium">
          {(["all", "telegram", "whatsapp"] as const).map((c) => (
            <button key={c} onClick={() => setChannel(c)} className={cn("rounded-[7px] px-2.5 py-1", channel === c ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]" : "text-[var(--muted)]")}>
              {c === "all" ? "All" : c === "telegram" ? "Telegram" : "WhatsApp"}
            </button>
          ))}
        </div>
      </div>

      {(!telegramReady || !whatsappReady) && (
        <p className="mb-2 text-[11px] text-[var(--muted)]">
          {!telegramReady && "Telegram user bot not logged in. "}
          {!whatsappReady && "WhatsApp Cloud API not configured. "}
          Set up under Admin → Integrations.
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] overflow-hidden rounded-[16px] border bg-[var(--surface)]">
        {/* thread list */}
        <div className="flex min-h-0 flex-col border-r">
          <div className="flex items-center gap-1.5 border-b p-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="h-9 pl-9 text-xs" />
            </div>
            <button onClick={openComposer} title="New message" className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-[var(--primary)] text-white">
              <Plus size={16} />
            </button>
          </div>

          {composerOpen && (
            <div className="border-b bg-[var(--surface-elevated)] p-3 text-xs">
              <p className="font-semibold">Message a number or handle</p>
              <div className="mt-2 flex gap-1.5">
                <select value={newChannel} onChange={(e) => setNewChannel(e.target.value as "whatsapp" | "telegram_userbot")} className="h-8 rounded-[8px] border bg-[var(--surface)] px-2">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram_userbot">Telegram</option>
                </select>
                <Input
                  value={newPeer}
                  onChange={(e) => setNewPeer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && startThread(newChannel, newPeer)}
                  placeholder={newChannel === "whatsapp" ? "9198XXXXXXXX" : "@username or phone"}
                  className="h-8 flex-1"
                />
                <button onClick={() => startThread(newChannel, newPeer)} disabled={starting || !newPeer.trim()} className="h-8 rounded-[8px] bg-[var(--primary)] px-2.5 font-semibold text-white disabled:opacity-50">
                  {starting ? <LoaderCircle size={13} className="animate-spin" /> : "Start"}
                </button>
              </div>

              {contacts.length > 0 && (
                <>
                  <p className="mt-3 font-semibold text-[var(--muted)]">Linked users</p>
                  <div className="mt-1.5 max-h-52 space-y-1 overflow-y-auto">
                    {contacts.map((c) => (
                      <div key={c.userId} className="rounded-[8px] border bg-[var(--surface)] px-2.5 py-1.5">
                        <p className="truncate text-[13px] font-medium">{c.name}</p>
                        <p className="truncate text-[10px] text-[var(--muted)]">{c.email}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.channels.map((ch) => (
                            <button
                              key={ch.platform + ch.address}
                              onClick={() => startThread(ch.platform === "whatsapp" ? "whatsapp" : "telegram_userbot", ch.handle && ch.platform !== "whatsapp" ? ch.handle : ch.address, c.name)}
                              className="rounded-md bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary)]"
                            >
                              {ch.platform === "whatsapp" ? "WhatsApp" : "Telegram"} →
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={cn("flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left", activeId === t.id ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--surface-elevated)]")}
              >
                <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: channelDot[t.channel] }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{t.peerName || t.userName || t.peerId}</span>
                    <span className="shrink-0 text-[10px] text-[var(--muted)]">{timeLabel(t.lastMessageAt)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-[var(--muted)]">{t.lastDirection === "out" ? "You: " : ""}{t.lastPreview}</span>
                    {t.unreadCount > 0 && <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white">{t.unreadCount}</span>}
                  </span>
                  {t.userEmail && <span className="mt-0.5 block truncate text-[10px] text-[var(--muted)]">{t.userEmail}</span>}
                </span>
              </button>
            ))}
            {!threads.length && <p className="p-6 text-center text-xs text-[var(--muted)]">No conversations yet. They appear when someone messages your Telegram or WhatsApp.</p>}
          </div>
        </div>

        {/* conversation */}
        <div className="flex min-h-0 flex-col">
          {active ? (
            <>
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <span className="size-2 rounded-full" style={{ background: channelDot[active.channel] }} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{active.peerName || active.userName || active.peerId}</p>
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {active.peerUsername ? `@${active.peerUsername} · ` : ""}{active.channel === "whatsapp" ? `+${active.peerId}` : active.peerId}
                    {active.userEmail ? ` · linked: ${active.userEmail}` : ""}
                  </p>
                </div>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-[var(--surface-elevated)] px-4 py-3">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[75%] rounded-[12px] px-3 py-2 text-sm", m.direction === "out" ? "bg-[var(--primary)] text-white" : "bg-[var(--surface)] border")}>
                      {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                      {MEDIA_KINDS.has(m.kind) && <MediaBubble message={m} onOpen={setPreview} />}
                      <span className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", m.direction === "out" ? "text-white/70" : "text-[var(--muted)]")}>
                        {timeLabel(m.createdAt)}
                        {m.direction === "out" && renderStatusIcon(m)}
                      </span>
                    </div>
                  </div>
                ))}
                {!messages.length && <p className="py-10 text-center text-xs text-[var(--muted)]">No messages loaded.</p>}
              </div>

              <div className="border-t p-3">
                {error && <p className="mb-2 text-xs text-[var(--critical)]">{error}</p>}

                {pollOpen && (
                  <div className="mb-2 rounded-[12px] border bg-[var(--surface-elevated)] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">New poll</span>
                      <button onClick={() => setPollOpen(false)} className="text-[var(--muted)]"><X size={14} /></button>
                    </div>
                    <Input value={pollQ} onChange={(e) => setPollQ(e.target.value)} placeholder="Question" className="mt-2 h-9" />
                    <div className="mt-1.5 space-y-1.5">
                      {pollOpts.map((o, i) => (
                        <Input
                          key={i}
                          value={o}
                          onChange={(e) => setPollOpts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                          placeholder={`Option ${i + 1}`}
                          className="h-8"
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {pollOpts.length < 10 && (
                        <button onClick={() => setPollOpts((a) => [...a, ""])} className="text-xs font-semibold text-[var(--primary)]">+ option</button>
                      )}
                      <button
                        onClick={sendPoll}
                        disabled={pollSending || !pollQ.trim() || pollOpts.filter((o) => o.trim()).length < 2}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {pollSending ? <LoaderCircle size={13} className="animate-spin" /> : <BarChart3 size={13} />}Send poll
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-[var(--muted)]">Telegram → native poll · WhatsApp → quick-reply buttons (≤3) or a list.</p>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-[10px] border text-[var(--muted)] hover:text-[var(--foreground)]" title="Attach" aria-label="Attach a file">
                    <Paperclip size={16} />
                  </button>
                  <button type="button" onClick={() => setPollOpen((v) => !v)} aria-pressed={pollOpen} className={cn("grid size-10 shrink-0 place-items-center rounded-[10px] border", pollOpen ? "border-[var(--primary)] text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--foreground)]")} title="Poll" aria-label="Create a poll">
                    <BarChart3 size={16} />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
                    onChange={(e) => e.target.files?.[0] && send(e.target.files[0])}
                  />
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    rows={1}
                    placeholder="Type a message…"
                    aria-label="Message"
                    className="max-h-32 min-h-10 flex-1 resize-none rounded-[10px] border bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                  <button type="button" onClick={() => send()} disabled={sending || (!draft.trim())} aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[var(--primary)] text-white disabled:opacity-50">
                    {sending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-[var(--muted)]">
              <div className="text-center">
                <MessageCircle size={28} className="mx-auto text-[var(--muted)]" />
                <p className="mt-2">Pick a conversation.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {preview && <Lightbox preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
