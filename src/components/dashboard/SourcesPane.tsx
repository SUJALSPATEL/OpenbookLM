"use client";

import { useState } from "react";
import { FileText, FileUp, Link2, Plus, SquarePlay, Trash2 } from "lucide-react";
import type { Source, SourceKind, SourceStatus } from "@/lib/types";

const KIND_ICON = { url: Link2, pdf: FileText, youtube: SquarePlay, text: FileText } as const;

const ADD_KINDS: { id: SourceKind; label: string; icon: typeof Link2 }[] = [
  { id: "url", label: "URL", icon: Link2 },
  { id: "pdf", label: "PDF / DOCX", icon: FileUp },
  { id: "youtube", label: "YouTube", icon: SquarePlay },
  { id: "text", label: "Text", icon: FileText },
];

function StatusChip({ status }: { status: SourceStatus }) {
  const map = {
    ready: { cls: "border-emerald-600/50 bg-emerald-500/10 text-emerald-600", label: "ready" },
    processing: { cls: "border-amber-600/50 bg-amber-500/10 text-amber-600", label: "indexing" },
    failed: { cls: "border-rose-600/50 bg-rose-500/10 text-rose-600", label: "failed" },
  }[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${map.cls}`}
    >
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

export default function SourcesPane({
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
                      <p className="truncate text-[12px] font-semibold text-app" title={s.title}>
                        {s.title}
                      </p>
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
