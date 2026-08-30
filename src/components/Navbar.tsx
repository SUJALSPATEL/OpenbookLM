"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import { IconArrowRight, IconMenu } from "./icons";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#studio", label: "Studio" },
  { href: "#no-bluff", label: "No-bluff" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b-2 border-line bg-app/90 backdrop-blur-md"
          : "border-b-2 border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        {/* Logo */}
        <a href="#" className="group flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="OpenbookLM Logo"
            width={32}
            height={32}
            className="h-8 w-8 transition-transform group-hover:-translate-y-0.5"
          />
          <span className="font-mono text-sm font-bold tracking-tight text-app">
            OpenbookLM
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-mono text-[13px] text-muted-c transition-colors hover:text-app"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <a
            href="/auth"
            className="group hidden items-center gap-1.5 rounded-md border-2 border-line bg-ink px-4 py-2 text-sm font-semibold text-on-ink shadow-hard-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard active:translate-y-0 active:shadow-none sm:inline-flex"
          >
            Try it
            <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border-2 border-line text-app md:hidden"
          >
            <IconMenu className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t-2 border-line bg-app px-5 py-4 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 font-mono text-[13px] text-muted-c transition-colors hover:bg-surface-2 hover:text-app"
              >
                {l.label}
              </a>
            ))}
            <a
              href="/auth"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-line bg-ink px-4 py-2.5 text-sm font-semibold text-on-ink"
            >
              Try OpenbookLM
              <IconArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
