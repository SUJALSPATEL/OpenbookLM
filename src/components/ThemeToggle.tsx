"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./icons";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border-2 border-line bg-surface text-muted-c shadow-hard-sm transition-all duration-150 hover:-translate-y-0.5 hover:text-app hover:shadow-hard active:translate-y-0.5 active:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      {mounted ? (
        dark ? (
          <IconSun className="h-[18px] w-[18px] anim-fade" />
        ) : (
          <IconMoon className="h-[18px] w-[18px] anim-fade" />
        )
      ) : (
        <span className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
