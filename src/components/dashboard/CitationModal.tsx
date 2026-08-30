"use client";

import { X } from "lucide-react";

export default function CitationModal({
  citationNumber,
  sourceTitle,
  content,
  onClose,
}: {
  citationNumber: number;
  sourceTitle: string;
  content: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-app/60 p-4 backdrop-blur-[2px] sm:p-6">
      <div className="anim-rise flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border-2 border-line bg-surface-2 shadow-hard-lg">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b-2 border-line px-4">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-[4px] border-2 border-line bg-chip px-1 font-mono text-[10px] font-bold text-chip">
            {citationNumber}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-bold text-app">
            {sourceTitle}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close citation"
            className="cursor-pointer rounded-sm p-1 text-muted-c transition-colors hover:text-app"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-app">{content}</p>
        </div>
        <div className="border-t-2 border-line px-4 py-2 font-mono text-[9.5px] text-muted-c">
          the exact passage this answer was grounded on
        </div>
      </div>
    </div>
  );
}
