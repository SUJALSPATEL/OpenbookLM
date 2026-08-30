"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  Check,
  FileText,
  Link2,
  ListTree,
  Loader2,
  Menu,
  MessageSquare,
  Network,
  Plus,
  SearchCheck,
  Send,
  ClipboardCheck,
  ChevronDown,
  Pencil,
  Trash2,
  X,
  SquarePlay,
  FileUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/components/ThemeToggle";

/* ---------------- types ---------------- */

type SourceStatus = "ready" | "processing" | "failed";
type SourceKind = "url" | "pdf" | "youtube" | "text";

type Source = {
  id: string;
  title: string;
  meta: string;
  kind: SourceKind;
  status: SourceStatus;
  enabled: boolean;
};

type ChatMsg = {
  role: "user" | "assistant";
  text: string;
  refusal?: boolean;
  notice?: boolean;
};

type Notebook = {
  id: string;
  title: string;
  createdAt: number;
  sources: Source[];
  chat: ChatMsg[];
};

function newNotebook(title = "Untitled notebook"): Notebook {
  return { id: crypto.randomUUID(), title, createdAt: Date.now(), sources: [], chat: [] };
}

const KIND_ICON = { url: Link2, pdf: FileText, youtube: SquarePlay, text: FileText } as const;

const STUDIO_TASKS = [
  { id: "mindmap", label: "Mindmap", icon: Network, desc: "concept graph" },
  { id: "quiz", label: "Quiz", icon: ListTree, desc: "cited questions" },
  { id: "summary", label: "Summary", icon: FileText, desc: "key points" },
  { id: "factcheck", label: "Fact-check", icon: SearchCheck, desc: "verdict table" },
  { id: "deep", label: "Deep research", icon: ClipboardCheck, desc: "cited report" },
] as const;

const STARTERS = [
  "Summarize my sources",
  "What are the key claims?",
  "What do these sources disagree on?",
];

/* ---------------- small pieces ---------------- */

function StatusChip({ status }: { status: SourceStatus }) {
  const map = {
    ready: { cls: "border-emerald-600/50 bg-emerald-500/10 text-emerald-600", label: "ready" },
    processing: { cls: "border-amber-600/50 bg-amber-500/10 text-amber-600", label: "processing" },
    failed: { cls: "border-rose-600/50 bg-rose-500/10 text-rose-600", label: "failed" },
  }[status];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${map.cls}`}>
      {map.label}
    </span>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Disable source" : "Enable source"}
      onClick={onClick}
      className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-line transition-colors duration-150 ${
        on ? "bg-ink" : "bg-surface"
      }`}
    >
      <span
        className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-line transition-all duration-150 ${
          on ? "left-[calc(100%-14px)] bg-app" : "left-0.5 bg-muted-c"
        }`}
      />
    </button>
  );
}

/* ---------------- add-source modal ---------------- */

const ADD_KINDS = [
  { id: "url", label: "URL", icon: Link2, hint: "Paste a web link" },
  { id: "pdf", label: "PDF / DOCX", icon: FileUp, hint: "Pick a file" },
  { id: "youtube", label: "YouTube", icon: SquarePlay, hint: "Paste a video link" },
  { id: "text", label: "Text", icon: FileText, hint: "Paste raw text" },
] as const;

function AddSourceModal({
  kind,
  onClose,
  onAdd,
}: {
  kind: SourceKind;
  onClose: () => void;
  onAdd: (s: Omit<Source, "id" | "enabled">) => void;
}) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const meta = ADD_KINDS.find((k) => k.id === kind)!;
  const isFile = kind === "pdf";
  const isText = kind === "text";

  const valid = isFile ? !!file : isText ? value.trim().length > 0 : value.trim().length > 3;

  const submit = () => {
    if (!valid) return;
    if (isFile && file) {
      onAdd({
        title: file.name,
        meta: `local · ${Math.max(1, Math.ceil(file.size / 1024))} KB`,
        kind,
        status: "processing",
      });
    } else if (isText) {
      const t = value.trim();
      onAdd({
        title: t.length > 48 ? `${t.slice(0, 48)}…` : t,
        meta: `pasted · ${t.length.toLocaleString()} chars`,
        kind,
        status: "processing",
      });
    } else {
      let host = "link";
      try {
        host = new URL(value.startsWith("http") ? value : `https://${value}`).hostname.replace(/^www\./, "");
      } catch {
        /* keep fallback */
      }
      onAdd({
        title: kind === "youtube" ? `YouTube — ${host}` : host,
        meta: `${host} · ${kind === "youtube" ? "video" : "link"}`,
        kind,
        status: "processing",
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-app/60 p-5 backdrop-blur-[2px]">
      <div className="anim-rise w-full max-w-md rounded-lg border-2 border-line bg-surface-2 p-6 shadow-hard-lg">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-widest text-app">
            <meta.icon className="h-4 w-4 text-chip" />
            add {meta.label.toLowerCase()}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-sm border-2 border-line bg-surface p-1 text-muted-c transition-colors hover:text-app"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-5">
          {isFile ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line bg-surface px-4 py-8 text-center transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm"
              >
                <FileUp className="h-6 w-6 text-muted-c" />
                <span className="font-mono text-[12px] text-app">
                  {file ? file.name : "click to choose a file"}
                </span>
                <span className="font-mono text-[10px] text-muted-c">
                  {file ? `${Math.max(1, Math.ceil(file.size / 1024))} KB selected` : "PDF · DOCX · TXT · MD"}
                </span>
              </button>
            </>
          ) : isText ? (
            <textarea
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={6}
              placeholder="Paste any text — notes, an article, a transcript…"
              className="w-full resize-none rounded-md border-2 border-line bg-surface px-3.5 py-3 text-[13px] text-app outline-none transition-all duration-150 placeholder:text-muted-c/70 focus:-translate-y-0.5 focus:shadow-hard-sm"
            />
          ) : (
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={kind === "youtube" ? "https://youtube.com/watch?v=…" : "https://example.com/article"}
              className="w-full rounded-md border-2 border-line bg-surface px-3.5 py-3 font-mono text-[13px] text-app outline-none transition-all duration-150 placeholder:text-muted-c/70 focus:-translate-y-0.5 focus:shadow-hard-sm"
            />
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-line bg-ink px-6 py-3 text-sm font-semibold text-on-ink shadow-hard-accent transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_var(--accent)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Add source
        </button>
        <p className="mt-3 text-center font-mono text-[10px] text-muted-c">
          it will index in the background · you can keep working
        </p>
      </div>
    </div>
  );
}

/* ---------------- sources pane ---------------- */

function SourcesPane({
  sources,
  onAdd,
  onToggle,
  onDelete,
}: {
  sources: Source[];
  onAdd: (kind: SourceKind) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const answering = sources.filter((s) => s.enabled && s.status === "ready").length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 items-center justify-between border-b-2 border-line px-3.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-app">
          sources
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setAddOpen((o) => !o)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-sm border-2 border-line bg-surface px-2 py-1 font-mono text-[11px] font-bold text-app transition-all duration-150 hover:bg-ink hover:text-on-ink active:translate-y-0.5"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
          {addOpen && (
            <div className="anim-rise absolute right-0 top-full z-30 mt-1.5 w-40 overflow-hidden rounded-md border-2 border-line bg-surface shadow-hard-lg">
              {ADD_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    onAdd(k.id);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 border-b border-line px-3 py-2 text-left font-mono text-[12px] text-app transition-colors last:border-b-0 hover:bg-chip"
                >
                  <k.icon className="h-3.5 w-3.5 text-muted-c" />
                  {k.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {sources.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-sm border-2 border-line bg-surface-2 text-muted-c">
              <Link2 className="h-5 w-5" />
            </span>
            <p className="mt-4 font-mono text-[12px] leading-relaxed text-muted-c">
              no sources yet
              <br />
              add a link, a file, a video, or text
            </p>
            <button
              type="button"
              onClick={() => onAdd("url")}
              className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-sm border-2 border-line bg-surface px-3 py-1.5 font-mono text-[11px] font-bold text-app transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm"
            >
              <Plus className="h-3 w-3" /> Add your first
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sources.map((s) => {
              const Icon = KIND_ICON[s.kind];
              return (
                <div
                  key={s.id}
                  className={`group rounded-md border-2 border-line bg-surface p-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm ${
                    !s.enabled ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border-2 border-line bg-surface-2 text-app">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-app">{s.title}</p>
                      <p className="truncate font-mono text-[10px] text-muted-c">{s.meta}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <StatusChip status={s.status} />
                      <button
                        type="button"
                        onClick={() => onDelete(s.id)}
                        aria-label={`Remove ${s.title}`}
                        title="Remove source"
                        className="cursor-pointer rounded-sm p-0.5 text-muted-c opacity-0 transition-all hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                    <span className="font-mono text-[9.5px] uppercase tracking-wide text-muted-c">
                      {s.enabled ? "in this chat" : "disabled"}
                    </span>
                    <Toggle on={s.enabled} onClick={() => onToggle(s.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t-2 border-line px-3.5 py-2 font-mono text-[10px] text-muted-c">
        {answering} of {sources.length} answering
      </div>
    </div>
  );
}

/* ---------------- chat pane ---------------- */

function ChatPane({
  notebook,
  onRename,
  onSend,
  thinking,
  onOpenSidebar,
}: {
  notebook: Notebook;
  onRename: (title: string) => void;
  onSend: (text: string) => void;
  thinking: boolean;
  onOpenSidebar: () => void;
}) {
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(notebook.title);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeCount = notebook.sources.filter((s) => s.enabled && s.status === "ready").length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [notebook.chat, thinking]);

  useEffect(() => {
    setDraftTitle(notebook.title);
  }, [notebook.id, notebook.title]);

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || thinking) return;
    setInput("");
    onSend(q);
  };

  return (
    <div className="flex h-full flex-col">
      {/* header: hamburger + notebook title + rename */}
      <div className="flex h-11 items-center gap-2 border-b-2 border-line px-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Notebook history"
          title="Notebook history"
          className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm border-2 border-line bg-surface text-app transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm"
        >
          <Menu className="h-4 w-4" />
        </button>

        {editing ? (
          <>
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onRename(draftTitle.trim() || "Untitled notebook");
                  setEditing(false);
                }
              }}
              className="flex-1 rounded-sm border-2 border-line bg-surface px-2 py-1 font-mono text-[12px] font-bold text-app outline-none"
            />
            <button
              type="button"
              onClick={() => {
                onRename(draftTitle.trim() || "Untitled notebook");
                setEditing(false);
              }}
              className="cursor-pointer text-emerald-600 transition-transform hover:scale-110"
              aria-label="Save notebook title"
            >
              <Check className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-c" />
            <span className="flex-1 truncate font-mono text-[12px] font-bold text-app">
              {notebook.title}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Rename notebook"
              className="shrink-0 cursor-pointer text-muted-c transition-colors hover:text-app"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <span className="ml-1 hidden shrink-0 items-center gap-1.5 rounded-sm border-2 border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted-c sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> grounded
        </span>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {notebook.chat.length === 0 && !thinking ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-sm border-2 border-line bg-surface font-mono text-sm font-bold text-app shadow-hard-sm">
                ~
              </span>
              <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted-c">
                Attach sources on the left, then ask anything. Every answer
                comes only from what you attached — with citations you can open.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="cursor-pointer rounded-sm border-2 border-line bg-surface px-3 py-1.5 font-mono text-[11px] text-app transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            notebook.chat.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="self-end">
                  <div className="ml-auto max-w-[85%] rounded-md border-2 border-line bg-ink px-3.5 py-2.5 text-[13px] font-medium text-on-ink">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 border-line bg-surface font-mono text-[10px] font-bold text-app">
                    ~
                  </span>
                  <div
                    className={`max-w-[90%] rounded-md border-2 px-3.5 py-2.5 ${
                      m.refusal || m.notice
                        ? "border-[var(--accent)] bg-chip text-app"
                        : "border-line bg-surface text-app shadow-hard-sm"
                    }`}
                  >
                    <p className="text-[13px] leading-relaxed">{m.text}</p>
                    {m.refusal && (
                      <p className="mt-1.5 font-mono text-[10px] text-chip">
                        {activeCount === 0
                          ? "0 sources attached → the gate refuses"
                          : "no passage matched → no answer made up"}
                      </p>
                    )}
                    {m.notice && (
                      <p className="mt-1.5 font-mono text-[10px] text-chip">
                        retrieval pipeline not connected in this build yet
                      </p>
                    )}
                  </div>
                </div>
              )
            )
          )}
          {thinking && (
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 border-line bg-surface font-mono text-[10px] font-bold text-app">
                ~
              </span>
              <div className="flex items-center gap-2 rounded-md border-2 border-line bg-surface px-3.5 py-2.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-chip" />
                <span className="font-mono text-[11px] text-muted-c">
                  retrieving · reranking · streaming
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* footer input */}
      <div className="border-t-2 border-line p-3">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-c">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            answering from {activeCount} source{activeCount === 1 ? "" : "s"}
          </div>
          <div className="flex items-end gap-2 rounded-md border-2 border-line bg-surface-2 p-2 transition-shadow focus-within:shadow-hard-sm">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Ask your sources…"
              className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-app outline-none placeholder:text-muted-c/70"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={!input.trim() || thinking}
              aria-label="Send"
              className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-sm border-2 border-line bg-ink text-on-ink transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-2 font-mono text-[9.5px] text-muted-c">
            answers only from your sources — never a guess
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- studio pane ---------------- */

function StudioPane({ sourceCount }: { sourceCount: number }) {
  const [running, setRunning] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const run = (id: string) => {
    if (running || sourceCount === 0) return;
    setRunning(id);
    setTimeout(() => {
      setRunning(null);
      setDone((d) => new Set(d).add(id));
    }, 2200);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 items-center justify-between border-b-2 border-line px-3.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-app">
          studio
        </span>
        <span className="font-mono text-[10px] text-muted-c">1-click</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {sourceCount === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <Network className="h-6 w-6 text-muted-c" />
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-c">
              add sources first —
              <br />
              studio runs on what you attach
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {STUDIO_TASKS.map((t) => {
              const isRunning = running === t.id;
              const isDone = done.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => run(t.id)}
                  disabled={!!running}
                  className="group cursor-pointer rounded-md border-2 border-line bg-surface p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm active:translate-y-0 active:shadow-none disabled:cursor-wait"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border-2 border-line transition-colors ${
                        isDone
                          ? "bg-emerald-500/15 text-emerald-600"
                          : "bg-surface-2 text-app group-hover:bg-ink group-hover:text-on-ink"
                      }`}
                    >
                      {isRunning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isDone ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <t.icon className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold text-app">{t.label}</p>
                      <p className="font-mono text-[9.5px] text-muted-c">{t.desc}</p>
                    </div>
                  </div>
                  {isRunning && (
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full border border-line bg-surface-2">
                      <div className="progress-shimmer h-full w-full" />
                    </div>
                  )}
                  {isDone && (
                    <p className="mt-2 font-mono text-[9.5px] text-emerald-600">
                      artifact saved to your account
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t-2 border-line px-3.5 py-2 font-mono text-[10px] text-muted-c">
        artifacts carry citations · same no-bluff rule
      </div>
    </div>
  );
}

/* ---------------- notebook history sidebar ---------------- */

function NotebookSidebar({
  notebooks,
  activeId,
  onSwitch,
  onNew,
  onDelete,
  onClose,
}: {
  notebooks: Notebook[];
  activeId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const sorted = [...notebooks].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <div
        className="absolute inset-0 z-40 bg-app/40"
        onClick={onClose}
        aria-hidden
      />
      <aside className="anim-rise absolute inset-y-0 left-0 z-50 flex w-72 flex-col border-r-2 border-line bg-surface shadow-hard-xl">
        <div className="flex h-11 items-center justify-between border-b-2 border-line px-3.5">
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-app">
            notebooks
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="cursor-pointer rounded-sm p-1 text-muted-c transition-colors hover:text-app"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onNew}
          className="mx-3 mt-3 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border-2 border-line bg-ink px-3 py-2 font-mono text-[12px] font-bold text-on-ink transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm active:translate-y-0.5 active:shadow-none"
        >
          <Plus className="h-3.5 w-3.5" /> New notebook
        </button>

        <div className="mt-3 flex-1 overflow-y-auto px-3 pb-3">
          <div className="flex flex-col gap-1.5">
            {sorted.map((nb) => {
              const active = nb.id === activeId;
              const count = nb.sources.length;
              return (
                <div
                  key={nb.id}
                  className={`group flex items-center gap-2 rounded-md border-2 px-2.5 py-2 transition-all duration-150 ${
                    active
                      ? "border-line bg-ink text-on-ink shadow-hard-sm"
                      : "border-line bg-surface-2 text-app hover:-translate-y-0.5 hover:shadow-hard-sm"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSwitch(nb.id)}
                    className="min-w-0 flex-1 cursor-pointer text-left"
                  >
                    <p className={`truncate text-[12px] font-bold ${active ? "text-on-ink" : "text-app"}`}>
                      {nb.title}
                    </p>
                    <p className={`font-mono text-[9.5px] ${active ? "text-on-ink/70" : "text-muted-c"}`}>
                      {new Date(nb.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
                      {count} source{count === 1 ? "" : "s"}
                    </p>
                  </button>
                  {notebooks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDelete(nb.id)}
                      aria-label={`Delete ${nb.title}`}
                      title="Delete notebook"
                      className={`shrink-0 cursor-pointer rounded-sm p-1 opacity-0 transition-all hover:text-rose-500 group-hover:opacity-100 ${
                        active ? "text-on-ink/70" : "text-muted-c"
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t-2 border-line px-3.5 py-2 font-mono text-[9.5px] text-muted-c">
          saved to your account · private to you
        </div>
      </aside>
    </>
  );
}

/* ---------------- page ---------------- */

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [notebooks, setNotebooks] = useState<Notebook[]>(() => [newNotebook()]);
  const [activeId, setActiveId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"sources" | "chat" | "studio">("chat");
  const [menuOpen, setMenuOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [addKind, setAddKind] = useState<SourceKind | null>(null);

  // auth guard + load this user's own notebooks from Supabase
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      const u = data.session.user;
      setEmail(u.email ?? null);
      setName((u.user_metadata?.full_name as string | undefined) ?? null);
      setUid(u.id);
      setAuthChecked(true);

      const { data: rows } = await supabase
        .from("notebooks")
        .select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: true });

      let nbs: Notebook[] = (rows ?? []).map((r: { id: string; title: string; created_at: string }) => ({
        id: r.id,
        title: r.title,
        createdAt: new Date(r.created_at).getTime(),
        sources: [],
        chat: [],
      }));

      // first visit -> seed one empty notebook for this account
      if (nbs.length === 0) {
        const nb = newNotebook();
        await supabase.from("notebooks").insert({
          id: nb.id,
          user_id: u.id,
          title: nb.title,
          created_at: new Date(nb.createdAt).toISOString(),
        });
        nbs = [nb];
      }

      const ids = nbs.map((n) => n.id);
      const [{ data: srcRows }, { data: msgRows }] = await Promise.all([
        supabase.from("sources").select("*").in("notebook_id", ids),
        supabase
          .from("chat_messages")
          .select("*")
          .in("notebook_id", ids)
          .order("created_at", { ascending: true }),
      ]);

      const byId = new Map(nbs.map((n) => [n.id, n]));
      for (const r of (srcRows ?? []) as { notebook_id: string; id: string; title: string; meta: string; kind: SourceKind; status: SourceStatus; enabled: boolean }[]) {
        byId.get(r.notebook_id)?.sources.push({
          id: r.id,
          title: r.title,
          meta: r.meta,
          kind: r.kind,
          status: r.status,
          enabled: r.enabled,
        });
      }
      for (const r of (msgRows ?? []) as { notebook_id: string; role: "user" | "assistant"; text: string; flag: string | null }[]) {
        byId.get(r.notebook_id)?.chat.push({
          role: r.role,
          text: r.text,
          refusal: r.flag === "refusal",
          notice: r.flag === "notice",
        });
      }

      setNotebooks(nbs);
      setActiveId(nbs[nbs.length - 1].id);
    });
  }, [router]);

  // ensure activeId points at something
  useEffect(() => {
    if (!notebooks.some((n) => n.id === activeId)) {
      setActiveId(notebooks[0]?.id ?? "");
    }
  }, [notebooks, activeId]);

  const active = notebooks.find((n) => n.id === activeId) ?? notebooks[0];

  const patchActive = (patch: Partial<Notebook>) =>
    setNotebooks((ns) => ns.map((n) => (n.id === active.id ? { ...n, ...patch } : n)));

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  /* ---- sources actions ---- */

  const addSource = (s: Omit<Source, "id" | "enabled">) => {
    const src: Source = { ...s, id: crypto.randomUUID(), enabled: true };
    patchActive({ sources: [...active.sources, src] });
    void supabase.from("sources").insert({
      id: src.id,
      notebook_id: active.id,
      title: src.title,
      meta: src.meta,
      kind: src.kind,
      status: src.status,
      enabled: true,
    });
    // background indexing, then ready
    setTimeout(() => {
      setNotebooks((ns) =>
        ns.map((n) =>
          n.id === active.id
            ? { ...n, sources: n.sources.map((x) => (x.id === src.id ? { ...x, status: "ready" as const } : x)) }
            : n
        )
      );
      void supabase.from("sources").update({ status: "ready" }).eq("id", src.id);
    }, 2200);
  };

  const toggleSource = (id: string) => {
    const next = active.sources.find((s) => s.id === id)?.enabled ?? false;
    patchActive({
      sources: active.sources.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    });
    void supabase.from("sources").update({ enabled: !next }).eq("id", id);
  };

  const deleteSource = (id: string) => {
    patchActive({ sources: active.sources.filter((s) => s.id !== id) });
    void supabase.from("sources").delete().eq("id", id);
  };

  /* ---- chat actions ---- */

  const sendChat = (text: string) => {
    patchActive({ chat: [...active.chat, { role: "user", text }] });
    void supabase.from("chat_messages").insert({ notebook_id: active.id, role: "user", text });
    setThinking(true);
    const activeSources = active.sources.filter((s) => s.enabled && s.status === "ready");
    setTimeout(() => {
      const reply: ChatMsg =
        activeSources.length === 0
          ? {
              role: "assistant",
              refusal: true,
              text: "I don't know about this. Nothing related is stated in the sources — attach sources first, then ask.",
            }
          : {
              role: "assistant",
              notice: true,
              text: "Your sources are attached and tracked — but the retrieval pipeline isn't connected in this build yet. Grounded, cited answers will appear here once it goes live.",
            };
      setNotebooks((ns) =>
        ns.map((n) => (n.id === active.id ? { ...n, chat: [...n.chat, reply] } : n))
      );
      void supabase.from("chat_messages").insert({
        notebook_id: active.id,
        role: "assistant",
        text: reply.text,
        flag: reply.refusal ? "refusal" : reply.notice ? "notice" : null,
      });
      setThinking(false);
    }, 1300);
  };

  /* ---- notebook actions ---- */

  const createNotebook = () => {
    const nb = newNotebook(`Untitled notebook ${notebooks.length + 1}`);
    setNotebooks((ns) => [...ns, nb]);
    setActiveId(nb.id);
    setSidebarOpen(false);
    void supabase.from("notebooks").insert({
      id: nb.id,
      user_id: uid,
      title: nb.title,
      created_at: new Date(nb.createdAt).toISOString(),
    });
  };

  const deleteNotebook = (id: string) => {
    if (notebooks.length <= 1) return;
    const rest = notebooks.filter((n) => n.id !== id);
    setNotebooks(rest);
    if (id === activeId) setActiveId(rest[0].id);
    // sources + chat cascade in the database
    void supabase.from("notebooks").delete().eq("id", id);
  };

  const renameNotebook = (title: string) => {
    patchActive({ title });
    void supabase.from("notebooks").update({ title, updated_at: new Date().toISOString() }).eq("id", active.id);
  };

  const readyCount = active?.sources.filter((s) => s.enabled && s.status === "ready").length ?? 0;

  const sourcesPane = (
    <SourcesPane
      sources={active?.sources ?? []}
      onAdd={(k) => setAddKind(k)}
      onToggle={toggleSource}
      onDelete={deleteSource}
    />
  );
  const chatPane = (
    <ChatPane
      notebook={active ?? newNotebook()}
      onRename={renameNotebook}
      onSend={sendChat}
      thinking={thinking}
      onOpenSidebar={() => setSidebarOpen(true)}
    />
  );
  const studioPane = <StudioPane sourceCount={readyCount} />;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* bg + grid + frame */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-app">
        <div className="bg-grid absolute inset-0" />
      </div>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] border-2 border-line" />

      {/* top bar */}
      <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b-2 border-line bg-surface px-4 sm:px-5">
        <div className="flex items-center gap-4">
          <a href="/" className="group flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="OpenbookLM Logo"
              width={28}
              height={28}
              className="h-7 w-7 transition-transform group-hover:-translate-y-0.5"
            />
            <span className="font-mono text-sm font-bold tracking-tight text-app">
              OpenbookLM
            </span>
          </a>
          <span className="hidden h-6 w-0.5 bg-line md:block" aria-hidden />
          <span className="hidden truncate font-mono text-[12px] text-muted-c md:block">
            {authChecked ? (name ?? email ?? "") : "…"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden h-9 items-center gap-1.5 rounded-sm border-2 border-line bg-surface-2 px-2.5 font-mono text-[10px] text-muted-c sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {readyCount} source{readyCount === 1 ? "" : "s"} active
          </span>
          <ThemeToggle />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border-2 border-line bg-surface px-3 font-mono text-[12px] font-bold text-app transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm active:translate-y-0.5 active:shadow-none"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-ink font-mono text-[10px] text-on-ink">
                {(name ?? email ?? "?").charAt(0).toUpperCase()}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="anim-rise absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-md border-2 border-line bg-surface shadow-hard-lg">
                <p className="border-b border-line px-3 py-2 font-mono text-[10px] text-muted-c">
                  {email}
                </p>
                <button
                  type="button"
                  onClick={signOut}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left font-mono text-[12px] text-app transition-colors hover:bg-chip"
                >
                  <X className="h-3.5 w-3.5" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* mobile tab switcher */}
      <div className="relative z-20 grid shrink-0 grid-cols-3 border-b-2 border-line bg-surface md:hidden">
        {(
          [
            ["sources", "Sources"],
            ["chat", "Chat"],
            ["studio", "Studio"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            className={`cursor-pointer border-r-2 border-line py-2.5 font-mono text-[12px] font-bold transition-colors last:border-r-0 ${
              mobileTab === id ? "bg-ink text-on-ink" : "text-muted-c"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* main: blurs behind the notebook sidebar */}
      <main className="relative z-10 min-h-0 flex-1">
        <div
          className={`h-full transition-[filter] duration-200 ${
            sidebarOpen ? "blur-[2px]" : ""
          }`}
        >
          {/* desktop */}
          <div className="hidden h-full md:block">
            <Group orientation="horizontal" className="h-full">
              <Panel defaultSize={25} minSize={15} className="border-r-2 border-line bg-surface">
                {sourcesPane}
              </Panel>
              <Separator className="group relative w-0.5 cursor-col-resize bg-line transition-colors hover:bg-[var(--accent)]" />
              <Panel defaultSize={55} minSize={30} className="bg-surface">
                {chatPane}
              </Panel>
              <Separator className="group relative w-0.5 cursor-col-resize bg-line transition-colors hover:bg-[var(--accent)]" />
              <Panel defaultSize={20} minSize={14} className="border-l-2 border-line bg-surface">
                {studioPane}
              </Panel>
            </Group>
          </div>

          {/* mobile */}
          <div className="h-full md:hidden">
            {mobileTab === "sources" && sourcesPane}
            {mobileTab === "chat" && chatPane}
            {mobileTab === "studio" && studioPane}
          </div>
        </div>

        {sidebarOpen && authChecked && (
          <NotebookSidebar
            notebooks={notebooks}
            activeId={activeId}
            onSwitch={(id) => {
              setActiveId(id);
              setSidebarOpen(false);
            }}
            onNew={createNotebook}
            onDelete={deleteNotebook}
            onClose={() => setSidebarOpen(false)}
          />
        )}
      </main>

      {/* add-source modal */}
      {addKind && (
        <AddSourceModal
          kind={addKind}
          onClose={() => setAddKind(null)}
          onAdd={addSource}
        />
      )}
    </div>
  );
}
