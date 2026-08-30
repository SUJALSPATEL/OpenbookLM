import Reveal from "./Reveal";
import {
  IconBan,
  IconCheck,
  IconColumns,
  IconShield,
  IconSparkle,
} from "./icons";

const FEATURES = [
  {
    icon: <IconCheck className="h-5 w-5" />,
    title: "Citations that open",
    body: "Every answer cites its sources inline. Click a [n] to jump to the exact passage — or hover to read it right there.",
  },
  {
    icon: <IconBan className="h-5 w-5" />,
    title: "It tells you when it doesn't know",
    body: "Ask something outside your sources and you get a plain “not in your sources” — not a confident guess dressed up as an answer.",
  },
  {
    icon: <IconSparkle className="h-5 w-5" />,
    title: "Studio, one click",
    body: "Turn the same sources into a mindmap, quiz, flashcards, summary, fact-check, or a cited research report. No re-uploading.",
  },
  {
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    title: "Sign in with Google",
    body: "One click, no passwords. Your notebooks, sources, chats, and artifacts follow you across devices.",
  },
  {
    icon: <IconColumns className="h-5 w-5" />,
    title: "Three panes, your layout",
    body: "Sources, chat, and studio side by side. Drag to resize, collapse what you don't need — the layout sticks.",
  },
  {
    icon: <IconShield className="h-5 w-5" />,
    title: "Private by default",
    body: "Every notebook is scoped to its owner at the database level — not just hidden in the UI. Your corpus stays yours.",
  },
];

export default function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="font-mono text-[13px] uppercase tracking-widest text-muted-c">
            features
          </p>
          <h2 className="mt-3 font-display text-3xl uppercase leading-[1.1] tracking-tight text-app sm:text-4xl">
            Grounded <span className="hl">by design.</span>
          </h2>
          <p className="mt-4 text-muted-c">
            Everything below follows from one rule: answers come from your
            sources, or they don&apos;t come at all.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal
              key={f.title}
              delay={i * 70}
              className="group relative rounded-lg border-2 border-line bg-surface p-6 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0 active:translate-y-0 active:shadow-none"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-sm border-2 border-line bg-surface-2 text-app transition-colors group-hover:bg-ink group-hover:text-on-ink">
                  {f.icon}
                </span>
                <span className="font-mono text-[12px] text-muted-c">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-5 text-base font-semibold tracking-tight text-app">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-c">
                {f.body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
