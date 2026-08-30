"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import { IconCheck, IconQuestion, IconSparkle } from "./icons";

/* ---------- mindmap mock ---------- */

function MindmapMock() {
  return (
    <svg viewBox="0 0 420 200" className="w-full" role="img" aria-label="Mindmap: Attention graph">
      <g stroke="var(--border-strong)" strokeWidth="1.4" fill="none">
        <path d="M210 90 C 170 90, 150 40, 118 38" />
        <path d="M210 90 C 170 90, 150 90, 118 90" />
        <path d="M210 90 C 170 90, 150 140, 118 142" />
        <path d="M210 90 C 260 90, 285 48, 318 44" />
        <path d="M210 90 C 260 90, 285 138, 318 140" />
      </g>
      <g fontFamily="var(--font-mono)" fontSize="11" textAnchor="middle">
        <rect x="166" y="74" width="88" height="32" rx="4" fill="var(--text)" stroke="var(--border-strong)" strokeWidth="1.5" />
        <text x="210" y="94" fill="var(--bg)" fontWeight="700">Attention</text>
        {[
          ["Self-attention", 70, 26],
          ["Multi-head", 70, 78],
          ["Positional enc.", 60, 130],
          ["KV cache", 322, 32],
          ["Scaling", 322, 128],
        ].map(([label, x, y]) => (
          <g key={label as string}>
            <rect x={x as number} y={y as number} width="96" height="24" rx="3" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
            <text x={(x as number) + 48} y={(y as number) + 16} fill="var(--text)">{label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ---------- quiz mock ---------- */

function QuizMock() {
  const options = [
    { letter: "A", text: "Layer normalization", correct: false },
    { letter: "B", text: "Multi-head attention", correct: true },
    { letter: "C", text: "Positional encoding", correct: false },
    { letter: "D", text: "Feed-forward expansion", correct: false },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-md border-2 border-line bg-surface-2 px-4 py-3 text-sm text-app">
        Which mechanism lets the model attend to multiple representation
        subspaces at once?
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <div
            key={o.letter}
            className={`flex items-center gap-2.5 rounded-md border-2 px-3.5 py-2.5 text-sm transition-transform hover:-translate-y-0.5 ${
              o.correct
                ? "border-line bg-chip text-app shadow-hard-sm"
                : "border-line bg-surface text-muted-c"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-sm border-2 border-line font-mono text-[11px] font-bold ${
                o.correct ? "bg-ink text-on-ink" : "bg-surface-2 text-app"
              }`}
            >
              {o.letter}
            </span>
            {o.text}
          </div>
        ))}
      </div>
      <p className="font-mono text-[12px] text-muted-c">
        explanation: Q / K / V are projected into h parallel subspaces [2]
      </p>
    </div>
  );
}

/* ---------- fact-check mock ---------- */

function FactCheckMock() {
  const rows = [
    {
      claim: "Attention is all you need introduces the transformer.",
      verdict: "supported",
      quote: "§1 — “We propose a new simple network architecture, the Transformer.”",
    },
    {
      claim: "The paper reports gains from reinforcement learning.",
      verdict: "contradicted",
      quote: "§5 — no RL step is mentioned in training or ablations.",
    },
    {
      claim: "Self-attention is O(n²) in sequence length.",
      verdict: "unverifiable",
      quote: "Not discussed in the attached sources.",
    },
  ];
  const styles: Record<string, string> = {
    supported: "text-emerald-600 border-line bg-emerald-500/10",
    contradicted: "text-rose-600 border-line bg-rose-500/10",
    unverifiable: "text-amber-600 border-line bg-amber-500/10",
  };
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.claim} className="rounded-md border-2 border-line bg-surface p-3 transition-transform hover:-translate-y-0.5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] leading-snug text-app">{r.claim}</p>
            <span className={`inline-flex shrink-0 items-center rounded-sm border-2 border-line px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${styles[r.verdict]}`}>
              {r.verdict}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-[10.5px] text-muted-c">{r.quote}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- deep research mock ---------- */

function DeepResearchMock() {
  const steps = [
    { label: "decomposing → 3 sub-queries", done: true },
    { label: "retrieving chunks · reranking", done: true },
    { label: "synthesizing cited report", running: true },
    { label: "compiling citations", pending: true },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((s) => (
        <div
          key={s.label}
          className="flex items-center gap-2.5 rounded-md border-2 border-line bg-surface px-3.5 py-2.5 font-mono text-[12px]"
        >
          {s.done && <IconCheck className="h-3.5 w-3.5 text-emerald-600" />}
          {s.running && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          )}
          {s.pending && <span className="h-3.5 w-3.5 rounded-full border-2 border-line" />}
          <span className={s.pending ? "text-muted-c/60" : "text-app"}>
            {s.label}
          </span>
        </div>
      ))}
      <p className="mt-1 rounded-md border-2 border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-muted-c">
        Across the three papers, retrieval-augmented pipelines outperform
        closed-book baselines on long-tail queries [1][3].
      </p>
    </div>
  );
}

/* ---------- tabs ---------- */

const TABS = [
  { id: "mindmap", label: "Mindmap", icon: <IconSparkle className="h-4 w-4" /> },
  { id: "quiz", label: "Quiz", icon: <IconQuestion className="h-4 w-4" /> },
  { id: "factcheck", label: "Fact-check", icon: <IconCheck className="h-4 w-4" /> },
  { id: "deep", label: "Deep research", icon: <IconSparkle className="h-4 w-4" /> },
];

export default function StudioShowcase() {
  const [active, setActive] = useState("quiz");

  return (
    <section id="studio" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="font-mono text-[13px] uppercase tracking-widest text-muted-c">
            studio
          </p>
          <h2 className="mt-3 font-display text-3xl uppercase leading-[1.1] tracking-tight text-app sm:text-4xl">
            One click. <span className="hl">Four artifacts.</span>
          </h2>
          <p className="mt-4 text-muted-c">
            Same sources, same citations — turned into a mindmap, a quiz, a
            fact-check table, or a full research report.
          </p>
        </Reveal>

        <Reveal delay={100} className="mt-10">
          <div className="flex flex-wrap gap-2.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-md border-2 border-line px-3.5 py-2 font-mono text-[12px] transition-all duration-150 ${
                  active === t.id
                    ? "bg-ink text-on-ink shadow-hard-sm"
                    : "bg-surface text-muted-c hover:-translate-y-0.5 hover:text-app hover:shadow-hard-sm"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-lg border-2 border-line bg-surface p-6 shadow-hard">
            <div className="mb-4 flex items-center justify-between border-b-2 border-line pb-3">
              <span className="font-mono text-[11px] uppercase tracking-widest text-app">
                artifact · {TABS.find((t) => t.id === active)?.label}
              </span>
              <span className="rounded-sm border-2 border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted-c">
                saved to your account
              </span>
            </div>
            {active === "mindmap" && <MindmapMock />}
            {active === "quiz" && <QuizMock />}
            {active === "factcheck" && <FactCheckMock />}
            {active === "deep" && <DeepResearchMock />}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
