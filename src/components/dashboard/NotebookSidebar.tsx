"use client";

import { Plus, Trash2, X } from "lucide-react";
import type { Notebook } from "@/lib/types";

export default function NotebookSidebar({
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
      <div className="absolute inset-0 z-40 bg-app/40" onClick={onClose} aria-hidden />
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
