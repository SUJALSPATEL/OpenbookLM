import Reveal from "./Reveal";
import { IconArrowRight, IconGoogle } from "./icons";

const STACK = [
  "Next.js",
  "FastAPI",
  "Supabase + pgvector",
  "Claude Opus 5",
  "BGE-M3",
];

export default function CtaSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-lg border-2 border-line bg-surface px-6 py-16 text-center shadow-hard-xl sm:px-12 sm:py-20">
            <div
              aria-hidden
              className="bg-grid pointer-events-none absolute inset-0 opacity-60"
            />
            <div className="relative">
              <p className="font-mono text-[13px] uppercase tracking-widest text-muted-c">
                get started
              </p>
              <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl uppercase leading-[1.05] tracking-tight text-app sm:text-5xl">
                Open a <span className="hl">notebook.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-muted-c sm:text-lg">
                Sign in with Google, paste a link, ask your first question.
                Every answer you get will be one your sources can back up.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href="/auth"
                  className="group inline-flex items-center gap-2.5 rounded-md border-2 border-line bg-ink px-8 py-4 text-sm font-semibold text-on-ink shadow-hard-accent transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_var(--accent)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_var(--accent)]"
                >
                  <IconGoogle className="h-5 w-5" />
                  Try OpenbookLM
                  <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
              <p className="mt-4 font-mono text-[12px] text-muted-c">
                one-click Google sign-in · free to start
              </p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                <span className="mr-1 font-mono text-[11px] uppercase tracking-widest text-muted-c">
                  built on →
                </span>
                {STACK.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center rounded-sm border-2 border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-muted-c transition-transform hover:-translate-y-0.5"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
