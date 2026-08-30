"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Menu, MessageSquare, Pencil, Send } from "lucide-react";
import RichText from "./RichText";
import { STARTERS, type ChatMsg, type Notebook } from "@/lib/types";

export default function ChatPane({
  notebook,
  onRename,
  onSend,
  thinking,
  streamingText,
  onOpenSidebar,
  onCitation,
}: {
  notebook: Notebook;
  onRename: (title: string) => void;
  onSend: (text: string) => void;
  thinking: boolean;
  streamingText: string | null;
  onOpenSidebar: () => void;
  onCitation: (msgIndex: number, n: number) => void;
}) {
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(notebook.title);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeCount = notebook.sources.filter((s) => s.enabled && s.status === "ready").length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [notebook.chat, thinking, streamingText]);

  useEffect(() => {
    setDraftTitle(notebook.title);
  }, [notebook.id, notebook.title]);

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || thinking) return;
    setInput("");
    onSend(q);
  };

  const saveTitle = () => {
    onRename(draftTitle.trim() || "Untitled notebook");
    setEditing(false);
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
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setDraftTitle(notebook.title);
                  setEditing(false);
                }
              }}
              className="flex-1 rounded-sm border-2 border-line bg-surface px-2 py-1 font-mono text-[12px] font-bold text-app outline-none"
            />
            <button
              type="button"
              onClick={saveTitle}
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
            <EmptyState activeCount={activeCount} onSend={send} />
          ) : (
            notebook.chat.map((m, i) => (
              <MessageBubble
                key={i}
                msg={m}
                onCitation={m.role === "assistant" && !m.notice ? (n) => onCitation(i, n) : undefined}
              />
            ))
          )}

          {thinking && (
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 border-line bg-surface font-mono text-[10px] font-bold text-app">
                ~
              </span>
              <div className="flex min-w-0 max-w-[90%] items-start gap-2 rounded-md border-2 border-line bg-surface px-3.5 py-2.5 shadow-hard-sm">
                {streamingText ? (
                  <div className="min-w-0 flex-1">
                    <RichText
                      text={streamingText}
                      onCitation={undefined}
                      className="text-[13px]"
                    />
                    <span className="anim-blink ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-chip" />
                  </div>
                ) : (
                  <>
                    <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-chip" />
                    <span className="font-mono text-[11px] text-muted-c">
                      retrieving · reranking · reading
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* footer input */}
      <div className="border-t-2 border-line p-3">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-c">
            <span className={`h-1.5 w-1.5 rounded-full ${activeCount > 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
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

/* ---------------- pieces ---------------- */

function EmptyState({
  activeCount,
  onSend,
}: {
  activeCount: number;
  onSend: (text: string) => void;
}) {
  return (
    <div className="flex h-full min-h-60 flex-col items-center justify-center text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-sm border-2 border-line bg-surface font-mono text-sm font-bold text-app shadow-hard-sm">
        ~
      </span>
      <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted-c">
        {activeCount > 0
          ? "Ask anything — every answer comes only from your attached sources, with citations you can open."
          : "Attach sources on the left, let them finish indexing, then ask anything. Every answer comes only from what you attached."}
      </p>
      {activeCount > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSend(s)}
              className="cursor-pointer rounded-sm border-2 border-line bg-surface px-3 py-1.5 font-mono text-[11px] text-app transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  onCitation,
}: {
  msg: ChatMsg;
  onCitation?: (n: number) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="self-end">
        <div className="ml-auto max-w-[85%] rounded-md border-2 border-line bg-ink px-3.5 py-2.5 text-[13px] font-medium text-on-ink">
          {msg.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 border-line bg-surface font-mono text-[10px] font-bold text-app">
        ~
      </span>
      <div
        className={`max-w-[90%] rounded-md border-2 px-3.5 py-2.5 ${
          msg.error
            ? "border-rose-600/60 bg-rose-500/10"
            : msg.refusal || msg.notice
              ? "border-[var(--accent)] bg-chip"
              : "border-line bg-surface shadow-hard-sm"
        }`}
      >
        <RichText text={msg.text} onCitation={onCitation} className="text-[13px]" />
        {msg.refusal && (
          <p className="mt-1.5 font-mono text-[10px] text-chip">no passage matched → no answer made up</p>
        )}
      </div>
    </div>
  );
}
