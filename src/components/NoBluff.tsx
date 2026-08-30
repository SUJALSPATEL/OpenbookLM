import Reveal from "./Reveal";
import { IconCheck } from "./icons";

const BULLETS = [
  {
    title: "Relevance gate",
    body: "If no retrieved passage clears the bar, the model is never called. There is nothing to hallucinate from.",
  },
  {
    title: "Citation guardrail",
    body: "Every [n] is checked against what was actually retrieved. Citations that don't resolve get stripped or regenerated.",
  },
  {
    title: "Tested, not claimed",
    body: "“Does it refuse every out-of-context question?” is part of the eval suite — and it gates merges.",
  },
];

export default function NoBluff() {
  return (
    <section id="no-bluff" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          {/* terminal exchange */}
          <Reveal>
            <p className="font-mono text-[13px] uppercase tracking-widest text-muted-c">
              the no-bluff check
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase leading-[1.1] tracking-tight text-app sm:text-4xl">
              Try to <span className="hl">trip it up.</span>
            </h2>
            <p className="mt-4 text-muted-c">
              Ask about anything you didn&apos;t upload. The answer is a plain
              refusal — enforced in the pipeline, not added as a disclaimer.
            </p>

            <div className="mt-6 rounded-lg border-2 border-line bg-surface p-5 font-mono text-[12.5px] leading-relaxed shadow-hard">
              <div className="flex gap-2 text-app">
                <span className="text-muted-c">$</span>
                <span>ask "what's the capital of France?"</span>
              </div>
              <div className="mt-3 space-y-1.5 text-muted-c">
                <p>· retrieval → 0 passages cleared the gate</p>
                <p>· model call → skipped · <span className="text-emerald-600">0 tokens</span></p>
              </div>
              <p className="mt-3 rounded-md border-2 border-line bg-surface-2 px-3 py-2.5 text-app">
                → “I don&apos;t know about this.”
              </p>

              <div className="mt-5 flex gap-2 text-app">
                <span className="text-muted-c">$</span>
                <span>ask "define self-attention"</span>
              </div>
              <div className="mt-3 space-y-1.5 text-muted-c">
                <p>· retrieval → top-k 6 · rerank 6 · gate passed</p>
                <p>· streamed answer · citations [2][4]</p>
              </div>
              <p className="mt-3 flex items-center gap-2 rounded-md border-2 border-line bg-surface-2 px-3 py-2.5 text-emerald-600">
                <IconCheck className="h-3.5 w-3.5" /> grounded ✓
              </p>
            </div>
          </Reveal>

          {/* explanation + contract */}
          <Reveal delay={120} className="flex flex-col gap-5">
            <div className="rounded-lg border-2 border-line bg-surface p-6 shadow-hard">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-c">
                the system prompt, literally
              </p>
              <blockquote className="mt-4 border-l-4 border-[var(--accent)] pl-4 font-mono text-[13px] leading-relaxed text-app">
                “You answer only from the provided passages. Cite [n] for every
                claim. If the passages do not contain the answer — even
                partially — reply exactly{' '}
                <span className="text-chip">
                  ‘Nothing related to this is stated in the sources’
                </span>
                . Never answer from your own knowledge.”
              </blockquote>
            </div>

            {BULLETS.map((b, i) => (
              <Reveal
                key={b.title}
                delay={160 + i * 80}
                className="rounded-lg border-2 border-line bg-surface p-6 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-muted-c">
                    0{i + 1}
                  </span>
                  <h3 className="text-base font-semibold tracking-tight text-app">
                    {b.title}
                  </h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-c">
                  {b.body}
                </p>
              </Reveal>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
