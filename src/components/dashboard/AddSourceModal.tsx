"use client";

import { useRef, useState } from "react";
import { FileText, FileUp, Link2, Plus, SquarePlay, X } from "lucide-react";
import type { SourceKind } from "@/lib/types";

export type NewSourceDraft = {
  kind: SourceKind;
  title: string;
  meta: string;
  url?: string;
  text?: string;
  file?: File;
};

const ADD_KINDS = [
  { id: "url" as const, label: "URL", icon: Link2 },
  { id: "pdf" as const, label: "PDF / DOCX", icon: FileUp },
  { id: "youtube" as const, label: "YouTube", icon: SquarePlay },
  { id: "text" as const, label: "Text", icon: FileText },
];

export default function AddSourceModal({
  kind,
  onClose,
  onAdd,
}: {
  kind: SourceKind;
  onClose: () => void;
  onAdd: (draft: NewSourceDraft) => void;
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
        kind,
        title: file.name,
        meta: `file · ${Math.max(1, Math.ceil(file.size / 1024))} KB`,
        file,
      });
    } else if (isText) {
      const t = value.trim();
      onAdd({
        kind,
        title: t.length > 48 ? `${t.slice(0, 48)}…` : t,
        meta: `pasted · ${t.length.toLocaleString()} chars`,
        text: t,
      });
    } else {
      let host = "link";
      try {
        host = new URL(value.startsWith("http") ? value : `https://${value}`)
          .hostname.replace(/^www\./, "");
      } catch {
        /* keep fallback */
      }
      onAdd({
        kind,
        title: kind === "youtube" ? `YouTube — ${host}` : host,
        meta: `${host} · ${kind === "youtube" ? "video" : "link"}`,
        url: value.trim(),
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-app/60 p-5 backdrop-blur-[2px]">
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
          it will extract, chunk, and index in the background
        </p>
      </div>
    </div>
  );
}
