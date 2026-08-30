import Reveal from "./Reveal";

const STEPS = [
  {
    n: "01",
    tag: "extract",
    title: "Attach",
    body: "Add a URL, PDF, YouTube video, or pasted text to a notebook. Whatever you want to work with.",
  },
  {
    n: "02",
    tag: "chunk → embed",
    title: "Index",
    body: "Text is extracted, chunked, and embedded in the background — you can start asking before it finishes.",
  },
  {
    n: "03",
    tag: "retrieve → rerank",
    title: "Ask",
    body: "Hybrid retrieval and reranking pick the passages that matter, then the model answers from those. Only those.",
  },
  {
    n: "04",
    tag: "gate → cite",
    title: "Check",
    body: "Answers cite passages you can open. Nothing relevant found? No model call, no answer — the guess never runs.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="font-mono text-[13px] uppercase tracking-widest text-muted-c">
            how it works
          </p>
          <h2 className="mt-3 font-display text-3xl uppercase leading-[1.1] tracking-tight text-app sm:text-4xl">
            Drop it in. <span className="hl">Ask away.</span>
          </h2>
          <p className="mt-4 text-muted-c">
            Four steps between a file on your desktop and an answer you can
            verify.
          </p>
        </Reveal>

        <div className="relative mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <div className="relative h-full rounded-lg border-2 border-line bg-surface p-6 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg">
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-sm border-2 border-line bg-ink font-mono text-sm font-bold text-on-ink shadow-hard-sm">
                  {s.n}
                </div>
                <p className="mt-5 font-mono text-[11px] uppercase tracking-widest text-chip">
                  {s.tag}
                </p>
                <h3 className="mt-1 text-base font-semibold tracking-tight text-app">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-c">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
