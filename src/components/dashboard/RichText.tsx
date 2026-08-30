"use client";

import { type ReactNode } from "react";

/**
 * Compact markdown renderer for chat answers and artifacts.
 * Supports headings, bullet/numbered lists, bold/italic/code, and renders
 * [n] citation markers as clickable chips.
 */
export default function RichText({
  text,
  onCitation,
  className = "",
}: {
  text: string;
  onCitation?: (n: number) => void;
  className?: string;
}) {
  const blocks = toBlocks(text);
  return <div className={className}>{blocks.map((b, i) => renderBlock(b, i, onCitation))}</div>;
}

/* ---------------- block parsing ---------------- */

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "bullet"; items: string[] }
  | { kind: "numbered"; items: string[] }
  | { kind: "paragraph"; text: string }
  | { kind: "divider" };

function toBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];

  const flushLists = () => {
    if (bullets.length) {
      blocks.push({ kind: "bullet", items: bullets });
      bullets = [];
    }
    if (numbers.length) {
      blocks.push({ kind: "numbered", items: numbers });
      numbers = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*—]{3,}\s*$/.test(line)) {
      flushLists();
      blocks.push({ kind: "divider" });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushLists();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      if (numbers.length) {
        blocks.push({ kind: "numbered", items: numbers });
        numbers = [];
      }
      bullets.push(bullet[1]);
      continue;
    }
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) {
      if (bullets.length) {
        blocks.push({ kind: "bullet", items: bullets });
        bullets = [];
      }
      numbers.push(numbered[1]);
      continue;
    }
    if (!line.trim()) {
      flushLists();
      continue;
    }
    flushLists();
    blocks.push({ kind: "paragraph", text: line });
  }
  flushLists();
  return blocks;
}

function renderBlock(block: Block, key: number, onCitation?: (n: number) => void): ReactNode {
  switch (block.kind) {
    case "heading": {
      const size =
        block.level === 1
          ? "text-base font-display uppercase tracking-tight"
          : block.level === 2
            ? "text-sm font-bold"
            : "text-[13px] font-bold";
      return (
        <p key={key} className={`mt-4 mb-1.5 text-app first:mt-0 ${size}`}>
          {inline(block.text, onCitation)}
        </p>
      );
    }
    case "bullet":
      return (
        <ul key={key} className="my-1.5 ml-1 flex flex-col gap-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-app">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <span className="min-w-0 flex-1">{inline(item, onCitation)}</span>
            </li>
          ))}
        </ul>
      );
    case "numbered":
      return (
        <ol key={key} className="my-1.5 ml-1 flex flex-col gap-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-app">
              <span className="shrink-0 font-mono text-[11px] font-bold text-chip">{i + 1}.</span>
              <span className="min-w-0 flex-1">{inline(item, onCitation)}</span>
            </li>
          ))}
        </ol>
      );
    case "divider":
      return <hr key={key} className="my-3 border-line" />;
    case "paragraph":
    default:
      return (
        <p key={key} className="my-1.5 leading-relaxed text-app">
          {inline(block.text, onCitation)}
        </p>
      );
  }
}

/* ---------------- inline parsing ---------------- */

const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|\[\d{1,2}\])/g;

function inline(text: string, onCitation?: (n: number) => void): ReactNode[] {
  const parts = text.split(INLINE_RE).filter((p) => p !== undefined && p !== "");
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={i} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code key={i} className="rounded-sm border border-line bg-surface-2 px-1 py-0.5 font-mono text-[11px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const citation = part.match(/^\[(\d{1,2})\]$/);
    if (citation) {
      const n = Number(citation[1]);
      return (
        <button
          key={i}
          type="button"
          onClick={onCitation ? () => onCitation(n) : undefined}
          className={`mx-0.5 inline-flex h-4 min-w-4 translate-y-[-1px] items-center justify-center rounded-[3px] border border-line bg-chip px-[3px] align-middle font-mono text-[9px] font-bold leading-none text-chip transition-all ${
            onCitation ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-hard-sm" : ""
          }`}
          title={onCitation ? `Show source ${n}` : undefined}
        >
          {n}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
