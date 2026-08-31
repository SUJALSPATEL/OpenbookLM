import Link from "next/link";

export default function AppPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
      </div>

      <span className="flex h-14 w-14 items-center justify-center rounded-md border-2 border-line bg-ink font-mono text-2xl font-bold text-on-ink shadow-hard">
        ~
      </span>
      <h1 className="mt-6 font-display text-3xl uppercase leading-[1.1] tracking-tight sm:text-4xl">
        The workspace is <span className="hl">coming.</span>
      </h1>
      <p className="mt-4 max-w-md text-muted-c">
        Next up: the three-pane workspace — Sources · Chat · Studio — with
        Google sign-in, grounded answers, and one-click artifacts.
      </p>
      <p className="mt-2 font-mono text-[12px] text-muted-c">
          {/*auth · RLS · ingestion → in the build*/}
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-md border-2 border-line bg-surface px-6 py-3 text-sm font-semibold text-app shadow-hard-sm transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      >
        ← Back to the landing page
      </Link>
    </div>
  );
}
