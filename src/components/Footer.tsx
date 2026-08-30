import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t-2 border-line">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <a href="#" className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="OpenbookLM Logo"
                width={32}
                height={32}
                className="h-8 w-8 transition-transform hover:-translate-y-0.5"
              />
              <span className="font-mono text-sm font-bold tracking-tight text-app">
                OpenbookLM
              </span>
            </a>
            <p className="mt-3 max-w-xs text-sm text-muted-c">
              Chat with your sources. Answers you can check, or a plain
              “not in your sources.”
            </p>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-c">
                Product
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a className="text-muted-c transition-colors hover:text-app" href="#features">Features</a></li>
                <li><a className="text-muted-c transition-colors hover:text-app" href="#how">How it works</a></li>
                <li><a className="text-muted-c transition-colors hover:text-app" href="#studio">Studio</a></li>
                <li><a className="text-muted-c transition-colors hover:text-app" href="#no-bluff">No-bluff</a></li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-c">
                App
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a className="text-muted-c transition-colors hover:text-app" href="/dashboard">Open workspace</a></li>
                <li><a className="text-muted-c transition-colors hover:text-app" href="/auth">Get started</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t-2 border-line pt-6 font-mono text-[12px] text-muted-c sm:flex-row sm:items-center">
          <p>
            © 2026 OpenbookLM — grounded research notebook
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            status · operational
          </p>
        </div>
      </div>
    </footer>
  );
}
