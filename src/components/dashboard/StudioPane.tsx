"use client";

import { Check, ClipboardCheck, FileText, ListTree, Loader2, Network, SearchCheck, Trash2 } from "lucide-react";
import { STUDIO_TASKS, type Artifact, type ArtifactType } from "@/lib/types";

const TASK_ICON = {
  mindmap: Network,
  quiz: ListTree,
  summary: FileText,
  factcheck: SearchCheck,
  deep: ClipboardCheck,
} as const;

export default function StudioPane({
  sourceCount,
  artifacts,
  running,
  error,
  onRun,
  onOpen,
  onDeleteArtifact,
}: {
  sourceCount: number;
  artifacts: Artifact[];
  running: ArtifactType | null;
  error: string | null;
  onRun: (type: ArtifactType) => void;
  onOpen: (artifact: Artifact) => void;
  onDeleteArtifact: (id: string) => void;
}) {
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
          <>
            {error && (
              <p className="mb-2.5 rounded-md border-2 border-rose-600/60 bg-rose-500/10 px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-rose-600">
                {error}
              </p>
            )}
            <div className="grid gap-2.5">
              {STUDIO_TASKS.map((t) => {
                const Icon = TASK_ICON[t.id];
                const isRunning = running === t.id;
                const count = artifacts.filter((a) => a.type === t.id).length;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onRun(t.id)}
                    disabled={!!running}
                    className="group cursor-pointer rounded-md border-2 border-line bg-surface p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm active:translate-y-0 active:shadow-none disabled:cursor-wait"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border-2 border-line bg-surface-2 text-app transition-colors group-hover:bg-ink group-hover:text-on-ink">
                        {isRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-app">{t.label}</p>
                        <p className="font-mono text-[9.5px] text-muted-c">{t.desc}</p>
                      </div>
                      {count > 0 && !isRunning && (
                        <span className="shrink-0 rounded-sm border-2 border-line bg-chip px-1.5 py-0.5 font-mono text-[9px] font-bold text-chip">
                          {count}
                        </span>
                      )}
                    </div>
                    {isRunning && (
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full border border-line bg-surface-2">
                        <div className="progress-shimmer h-full w-full" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {artifacts.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-c">
                  artifacts
                </p>
                <div className="flex flex-col gap-1.5">
                  {[...artifacts]
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((a) => (
                      <div
                        key={a.id}
                        className="group flex items-center gap-2 rounded-md border-2 border-line bg-surface-2 px-2.5 py-2 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm"
                      >
                        <button
                          type="button"
                          onClick={() => onOpen(a)}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                        >
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11.5px] font-bold text-app">{a.title}</span>
                            <span className="block font-mono text-[9px] text-muted-c">
                              {new Date(a.createdAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteArtifact(a.id)}
                          aria-label={`Delete ${a.title}`}
                          title="Delete artifact"
                          className="shrink-0 cursor-pointer rounded-sm p-1 text-muted-c opacity-0 transition-all hover:text-rose-600 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t-2 border-line px-3.5 py-2 font-mono text-[10px] text-muted-c">
        artifacts carry citations · same no-bluff rule
      </div>
    </div>
  );
}
