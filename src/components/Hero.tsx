"use client";

import { useEffect, useState } from "react";
import Reveal from "./Reveal";
import {
  IconArrowRight,
  IconFile,
  IconLink,
  IconSparkle,
  IconText,
  IconVideo,
} from "./icons";

/* ---------------- cycling chat demo ---------------- */

type Demo = { q: string; a: string; refs: number[] };

const DEMOS: Demo[] = [
  {
    q: "Compare the evaluation methods across these three papers.",
    a: "Papers A and B report nDCG on the same two corpora; Paper C uses ROUGE only. A and B agree within 2% — variance is dominated by the corpus, not the method.",
    refs: [1, 2, 3],
  },
  {
    q: "What does section 3.2 say about early-termination fees?",
    a: "Section 3.2 requires a 60-day written notice window. Terminating earlier incurs a fee equal to one month's rent.",
    refs: [4],
  },
  {
    q: "Where does the paper say the model can \"make things up\"?",
    a: "That claim isn't in your sources. Nothing related to this is stated in the sources.",
    refs: [],
  },
];

function ChatCycle({ nudge }: { nudge: number }) {
  const [i, setI] = useState(0);
  const [showA, setShowA] = useState(false);
  const [qKey, setQKey] = useState(0);
  const [teaser, setTeaser] = useState(false);

  useEffect(() => {
    setQKey((k) => k + 1);
    const t = setTimeout(() => setShowA(true), 1500);
    return () => clearTimeout(t);
  }, [i]);

  useEffect(() => {
    if (!showA) return;
    const t = setTimeout(() => {
      setShowA(false);
      setI((p) => (p + 1) % DEMOS.length);
    }, 5600);
    return () => clearTimeout(t);
  }, [showA]);

  // any interaction with the mockup drops this into the chat
  useEffect(() => {
    if (nudge === 0) return;
    setTeaser(true);
    const t = setTimeout(() => setTeaser(false), 7000);
    return () => clearTimeout(t);
  }, [nudge]);

  const demo = DEMOS[i];

  return (
    <div className="flex flex-col gap-4">
      {/* user */}
      <div key={`q-${i}-${qKey}`} className="anim-rise self-end">
        <div className="max-w-[88%] rounded-md border-2 border-line bg-ink px-3.5 py-2.5 text-[12.5px] font-medium text-on-ink">
          {demo.q}
        </div>
      </div>

      {/* assistant */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 border-line bg-surface font-mono text-[10px] font-bold text-app">
          ~
        </div>
        <div className="anim-rise max-w-[92%] rounded-md border-2 border-line bg-surface px-3.5 py-2.5 shadow-hard-sm">
          {showA ? (
            <>
              <p className="text-[12.5px] leading-relaxed text-app">{demo.a}</p>
              {demo.refs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {demo.refs.map((n) => (
                    <span
                      key={n}
                      className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border-2 border-line bg-chip px-1 font-mono text-[10px] font-bold text-chip"
                    >
                      {n}
                    </span>
                  ))}
                  <span className="font-mono text-[10px] text-muted-c">
                    · opens the exact passage
                  </span>
                </div>
              )}
              {demo.refs.length === 0 && (
                <div className="mt-2 font-mono text-[10px] text-chip">
                  no passage matched → no answer made up
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] anim-pulse-dot" />
              <span className="font-mono text-[11px] text-muted-c">
                retrieving · reranking · streaming
              </span>
              <span className="font-mono text-[11px] text-muted-c anim-blink">
                ▍
              </span>
            </div>
          )}
        </div>
      </div>

      {/* teaser reply after interacting with the mockup */}
      {teaser && (
        <div className="anim-rise flex items-start gap-2">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 border-line bg-chip font-mono text-[10px] font-bold text-chip">
            ~
          </div>
          <div className="max-w-[92%] rounded-md border-2 border-[var(--accent)] bg-chip px-3.5 py-2.5 shadow-hard-sm">
            <p className="text-[12.5px] font-semibold leading-relaxed text-app">
              Seems Tempting? Get started by signing up Cutie
            </p>
            <a
              href="/auth"
              className="group mt-2 inline-flex items-center gap-1.5 rounded-sm border-2 border-line bg-ink px-2.5 py-1 font-mono text-[10px] font-bold text-on-ink transition-transform hover:-translate-y-0.5"
            >
              Sign up
              <IconArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- the app window mockup ---------------- */

function StatusChip({
  status,
}: {
  status: "ready" | "processing" | "failed";
}) {
  const map = {
    ready: { dot: "bg-emerald-500", text: "text-emerald-600", label: "ready" },
    processing: {
      dot: "bg-amber-500 animate-pulse",
      text: "text-amber-600",
      label: "processing",
    },
    failed: { dot: "bg-rose-500", text: "text-rose-600", label: "failed" },
  }[status];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px]">
      <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
      <span className={map.text}>{map.label}</span>
    </span>
  );
}

function SourceRow({
  icon,
  title,
  meta,
  status,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  status: "ready" | "processing";
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border-2 border-line bg-surface-2 px-2.5 py-2 transition-transform duration-150 hover:-translate-y-0.5">
      <span className="text-app">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-app">{title}</p>
        <p className="truncate font-mono text-[10px] text-muted-c">{meta}</p>
      </div>
      <StatusChip status={status} />
    </div>
  );
}

function AppMockup() {
  const [nudge, setNudge] = useState(0);
  const poke = () => setNudge((n) => n + 1);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-lg border-2 border-line bg-surface shadow-hard-lg">
        {/* title bar */}
        <div className="flex items-center gap-2 border-b-2 border-line bg-surface-2 px-3.5 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-line bg-[#e02424]" />
            <span className="h-2.5 w-2.5 rounded-full border-2 border-line bg-[#eab308]" />
            <span className="h-2.5 w-2.5 rounded-full border-2 border-line bg-[#16a34a]" />
          </div>
          <span className="ml-3 flex-1 truncate text-center font-mono text-[11px] text-muted-c">
            OpenbookLM — notebook
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> grounded
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.55fr_1.15fr]">
          {/* ---- SOURCES ---- */}
          <div className="hidden border-r-2 border-line p-3 md:block">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-app">
                sources
              </span>
              <button
                type="button"
                onClick={poke}
                className="inline-flex cursor-pointer items-center gap-1 rounded-sm border-2 border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-app transition-all duration-150 hover:bg-ink hover:text-on-ink active:translate-y-0.5"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <SourceRow
                icon={<IconLink className="h-3.5 w-3.5" />}
                title="Agentic RAG — A Survey"
                meta="arxiv.org · 42k chars"
                status="ready"
              />
              <SourceRow
                icon={<IconVideo className="h-3.5 w-3.5" />}
                title="Attention — full lecture"
                meta="youtube.com · 48 min"
                status="ready"
              />
              <SourceRow
                icon={<IconFile className="h-3.5 w-3.5" />}
                title="lease_agreement_2026.pdf"
                meta="local · 14 pages"
                status="processing"
              />
              <SourceRow
                icon={<IconText className="h-3.5 w-3.5" />}
                title="Notes — hybrid retrieval"
                meta="pasted · 3.1k chars"
                status="ready"
              />
            </div>
            <p className="mt-3 font-mono text-[10px] text-muted-c">
              3 ready · 1 processing
            </p>
          </div>

          {/* ---- CHAT ---- */}
          <div className="flex flex-col p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-app">
                chat
              </span>
              <span className="rounded-sm border-2 border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-c">
                Claude Opus 5
              </span>
            </div>
            <div className="min-h-[236px]">
              <ChatCycle nudge={nudge} />
            </div>
            <button
              type="button"
              onClick={poke}
              className="mt-3 flex cursor-pointer items-center gap-2 rounded-md border-2 border-line bg-surface-2 px-3 py-2.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm active:translate-y-0 active:shadow-none"
            >
              <span className="font-mono text-[11px] text-muted-c">
                Ask your sources…
              </span>
              <span className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-sm border-2 border-line bg-ink text-on-ink">
                <IconArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>

          {/* ---- STUDIO ---- */}
          <div className="hidden border-l-2 border-line p-3 lg:block">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-app">
                studio
              </span>
              <span className="font-mono text-[10px] text-muted-c">1-click</span>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={poke}
                className="cursor-pointer rounded-md border-2 border-line bg-chip px-2.5 py-2 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm active:translate-y-0 active:shadow-none"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-app">
                    <IconSparkle className="h-3.5 w-3.5 text-chip" /> Mindmap
                  </span>
                  <span className="font-mono text-[10px] text-chip">68%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full border border-line bg-surface">
                  <div
                    className="progress-shimmer h-full rounded-full"
                    style={{ width: "68%" }}
                  />
                </div>
              </button>
              {["Quiz", "Summary", "Fact-check", "Deep research", "Flashcards"].map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={poke}
                    className="flex cursor-pointer items-center justify-between rounded-md border-2 border-line bg-surface px-2.5 py-2 text-[11px] text-muted-c transition-all duration-150 hover:-translate-y-0.5 hover:text-app hover:shadow-hard-sm active:translate-y-0 active:shadow-none"
                  >
                    {t}
                    <IconArrowRight className="h-3 w-3" />
                  </button>
                ),
              )}
            </div>
            <p className="mt-3 font-mono text-[10px] text-muted-c">
              artifacts save to your account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- hero ---------------- */

const SOURCES = [
  { label: "URL", icon: <IconLink className="h-3 w-3" /> },
  { label: "PDF", icon: <IconFile className="h-3 w-3" /> },
  { label: "DOCX", icon: <IconFile className="h-3 w-3" /> },
  { label: "YouTube", icon: <IconVideo className="h-3 w-3" /> },
  { label: "TXT", icon: <IconText className="h-3 w-3" /> },
  { label: "MD", icon: <IconText className="h-3 w-3" /> },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-32 sm:pt-40">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* kicker */}
        <Reveal className="flex justify-center">
          <div className="inline-flex items-center gap-2 border-2 border-line bg-surface px-3.5 py-1.5 font-mono text-[12px] text-muted-c shadow-hard-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            AI research notebook · grounded in your sources
          </div>
        </Reveal>

        {/* headline */}
        <Reveal delay={80}>
          <h1 className="mx-auto mt-8 max-w-4xl text-center font-display text-4xl uppercase leading-[1.05] tracking-tight text-app sm:text-6xl">
            Upload your sources.
            <br />
            <span className="hl">Ask anything.</span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mx-auto mt-8 max-w-2xl text-center text-base leading-[1.85] text-muted-c sm:text-lg">
            Drop in a PDF, a link, a YouTube lecture, or your notes. Every
            answer comes from exactly what you attached — click a citation to
            read the passage it came from. And if it isn&apos;t in your
            sources, it says so.
          </p>
        </Reveal>

        {/* CTAs */}
        <Reveal delay={240} className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href="/auth"
            className="group inline-flex items-center gap-2 rounded-md border-2 border-line bg-ink px-7 py-3.5 text-sm font-semibold text-on-ink shadow-hard-accent transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_var(--accent)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_var(--accent)]"
          >
            Try OpenbookLM
            <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href="#how"
            className="inline-flex items-center gap-2 rounded-md border-2 border-line bg-surface px-7 py-3.5 text-sm font-semibold text-app transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            How it works
          </a>
        </Reveal>

        <Reveal delay={300}>
          <p className="mt-5 text-center font-mono text-[12px] text-muted-c">
            free to start · Google sign-in · answers only from your sources
          </p>
        </Reveal>

        {/* app mockup */}
        <Reveal delay={380} className="mt-14">
          <AppMockup />
        </Reveal>

        {/* source chips */}
        <Reveal delay={440}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            <span className="mr-1 font-mono text-[11px] uppercase tracking-widest text-muted-c">
              attach anything →
            </span>
            {SOURCES.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1.5 rounded-sm border-2 border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-app transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm"
              >
                {s.icon}
                {s.label}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
