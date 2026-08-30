"use client";

import { useMemo, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import RichText from "./RichText";
import type { Artifact } from "@/lib/types";

const TYPE_LABEL = {
  mindmap: "mindmap",
  quiz: "quiz",
  summary: "summary",
  factcheck: "fact-check",
  deep: "deep research",
} as const;

export default function ArtifactModal({
  artifact,
  onClose,
}: {
  artifact: Artifact;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-app/60 p-4 backdrop-blur-[2px] sm:p-6">
      <div className="anim-rise flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border-2 border-line bg-surface-2 shadow-hard-lg">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b-2 border-line px-4">
          <span className="rounded-sm border-2 border-line bg-chip px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-chip">
            {TYPE_LABEL[artifact.type]}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-bold text-app">
            {artifact.title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close artifact"
            className="cursor-pointer rounded-sm p-1 text-muted-c transition-colors hover:text-app"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <Body artifact={artifact} />
        </div>
      </div>
    </div>
  );
}

function Body({ artifact }: { artifact: Artifact }) {
  if (artifact.type === "quiz") {
    const quiz = safeParse(artifact.content);
    if (Array.isArray(quiz?.questions)) {
      return <QuizView quiz={quiz as unknown as { title?: string; questions: QuizQuestion[] }} />;
    }
  }
  if (artifact.type === "factcheck") {
    const fc = safeParse(artifact.content);
    if (Array.isArray(fc?.checks)) {
      return <FactCheckView checks={fc.checks as unknown as FactCheck[]} />;
    }
  }
  if (artifact.type === "mindmap") return <MindmapView content={artifact.content} />;
  return <RichText text={artifact.content} className="text-[13px]" />;
}

function safeParse(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/* ---------------- quiz ---------------- */

type QuizQuestion = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  citation: number | null;
};

function QuizView({ quiz }: { quiz: { title?: string; questions: QuizQuestion[] } }) {
  const questions = quiz.questions;
  const [selections, setSelections] = useState<Record<number, number>>({});

  const score = questions.reduce(
    (acc, q, i) => acc + (selections[i] === q.answer ? 1 : 0),
    0
  );
  const answered = Object.keys(selections).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-app">{quiz.title ?? "Quiz"}</p>
        <div className="flex items-center gap-2">
          <span className="rounded-sm border-2 border-line bg-surface px-2 py-1 font-mono text-[11px] font-bold text-app">
            {score}/{questions.length} correct
          </span>
          {answered > 0 && (
            <button
              type="button"
              onClick={() => setSelections({})}
              className="inline-flex cursor-pointer items-center gap-1 rounded-sm border-2 border-line bg-surface px-2 py-1 font-mono text-[10px] text-muted-c transition-colors hover:text-app"
            >
              <RotateCcw className="h-3 w-3" /> retry
            </button>
          )}
        </div>
      </div>

      {questions.map((q, qi) => {
        const chosen = selections[qi];
        const revealed = chosen !== undefined;
        return (
          <div key={qi} className="rounded-md border-2 border-line bg-surface p-3.5">
            <p className="text-[13px] font-bold text-app">
              {qi + 1}. {q.question}
              {q.citation != null && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 translate-y-[-1px] items-center justify-center rounded-[3px] border border-line bg-chip px-[3px] align-middle font-mono text-[9px] font-bold leading-none text-chip">
                  {q.citation}
                </span>
              )}
            </p>
            <div className="mt-2.5 grid gap-1.5">
              {q.options?.map((opt, oi) => {
                const isCorrect = oi === q.answer;
                const isChosen = chosen === oi;
                let cls = "border-line bg-surface-2 text-app hover:-translate-y-0.5 hover:shadow-hard-sm";
                if (revealed && isCorrect) cls = "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
                else if (revealed && isChosen) cls = "border-rose-600 bg-rose-500/10 text-rose-700 dark:text-rose-400";
                else if (revealed) cls = "border-line bg-surface-2 text-muted-c opacity-70";
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={revealed}
                    onClick={() => setSelections((s) => ({ ...s, [qi]: oi }))}
                    className={`flex cursor-pointer items-center gap-2 rounded-sm border-2 px-2.5 py-2 text-left text-[12.5px] transition-all duration-150 disabled:cursor-default ${cls}`}
                  >
                    <span className="font-mono text-[10px] font-bold opacity-60">
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                    {revealed && isCorrect && <span className="ml-auto font-mono text-[10px] font-bold">correct</span>}
                    {revealed && isChosen && !isCorrect && <span className="ml-auto font-mono text-[10px] font-bold">your pick</span>}
                  </button>
                );
              })}
            </div>
            {revealed && q.explanation && (
              <p className="mt-2.5 rounded-sm border-l-4 border-[var(--accent)] bg-chip px-2.5 py-2 text-[12px] leading-relaxed text-app">
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- fact-check ---------------- */

type FactCheck = {
  claim: string;
  verdict: "supported" | "contradicted" | "not found" | string;
  evidence: string;
  citation: number | null;
};

function FactCheckView({ checks }: { checks: FactCheck[] }) {
  const verdictMeta = (verdict: string) => {
    switch (verdict) {
      case "supported":
        return { label: "supported", cls: "border-emerald-600/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" };
      case "contradicted":
        return { label: "contradicted", cls: "border-rose-600/60 bg-rose-500/10 text-rose-700 dark:text-rose-400" };
      default:
        return { label: "not found", cls: "border-amber-600/60 bg-amber-500/10 text-amber-700 dark:text-amber-400" };
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {checks.map((c, i) => {
        const meta = verdictMeta(c.verdict);
        return (
          <div key={i} className="rounded-md border-2 border-line bg-surface p-3.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-bold leading-snug text-app">{c.claim}</p>
              <span
                className={`inline-flex shrink-0 items-center rounded-sm border-2 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide ${meta.cls}`}
              >
                {meta.label}
              </span>
            </div>
            {c.evidence && (
              <p className="mt-2 border-l-4 border-line pl-2.5 text-[12.5px] leading-relaxed text-muted-c">
                {c.evidence}
                {c.citation != null && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 translate-y-[-1px] items-center justify-center rounded-[3px] border border-line bg-chip px-[3px] align-middle font-mono text-[9px] font-bold leading-none text-chip">
                    {c.citation}
                  </span>
                )}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- mindmap ---------------- */

type MindNode = { text: string; level: number; children: MindNode[] };

function MindmapView({ content }: { content: string }) {
  const roots = useMemo(() => parseMindmap(content), [content]);
  if (roots.length === 0) {
    return <RichText text={content} className="text-[13px]" />;
  }
  return (
    <div className="flex flex-col gap-1">
      {roots.map((node, i) => (
        <MindNodeView key={i} node={node} />
      ))}
    </div>
  );
}

function MindNodeView({ node }: { node: MindNode }) {
  const isRoot = node.level === 0;
  return (
    <div className={isRoot ? "" : "ml-3 border-l-2 border-line pl-3"}>
      <div
        className={`my-0.5 flex items-start gap-2 rounded-sm px-2 py-1 ${
          isRoot
            ? "border-2 border-line bg-surface font-bold shadow-hard-sm"
            : "bg-surface-2/60"
        }`}
      >
        <span
          className={`mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full ${
            isRoot ? "bg-[var(--accent)]" : "bg-muted-c"
          }`}
        />
        <RichText text={node.text} className={`min-w-0 flex-1 ${isRoot ? "text-[13px] text-app" : "text-[12px] text-app"}`} />
      </div>
      {node.children.length > 0 && (
        <div className="flex flex-col">
          {node.children.map((child, i) => (
            <MindNodeView key={i} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

function parseMindmap(content: string): MindNode[] {
  const roots: MindNode[] = [];
  const stack: MindNode[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const match = line.match(/^(\s*)[-*•]\s+(.*)$/);
    if (!match) continue;
    const level = Math.min(3, Math.floor(match[1].length / 2));
    const text = match[2].trim();
    if (!text) continue;

    const node: MindNode = { text, level, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return roots;
}
