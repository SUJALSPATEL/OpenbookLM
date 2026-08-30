"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { IconArrowRight, IconGoogle } from "@/components/icons";

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // already signed in -> straight to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (err) throw err;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setNotice("Check your inbox — confirm your email, then log in.");
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message.replace(/^AuthApiError:\s*/, "") : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-md border-2 border-line bg-surface px-3.5 py-3 text-sm text-app placeholder:text-muted-c/70 outline-none transition-all duration-150 focus:-translate-y-0.5 focus:shadow-hard-sm focus:border-line-strong";

  return (
    <div className="min-h-screen">
      {/* bg + grid + frame (same as landing) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-app">
        <div className="bg-grid absolute inset-0" />
      </div>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] border-2 border-line" />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-8 sm:px-8">
        {/* back link */}
        <a href="/" className="group flex items-center gap-2 self-start font-mono text-[13px] text-muted-c transition-colors hover:text-app">
          <IconArrowRight className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-1" />
          back to home
        </a>

        {/* two-column body */}
        <div className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-2 lg:gap-16">
          {/* ---- left: brand + headline ---- */}
          <div className="order-2 lg:order-1">
            <Image
              src="/logo.png"
              alt="OpenbookLM Logo"
              width={96}
              height={96}
              className="h-20 w-20 sm:h-24 sm:w-24"
              priority
            />
            <h1 className="mt-6 font-display text-2xl uppercase leading-[1.35] tracking-tight text-app sm:text-3xl lg:text-4xl">
              Glad you&apos;re here.
              <br />
              You are <span className="hl">exactly what my system needs.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-[1.85] text-muted-c sm:text-base">
              {mode === "signup"
                ? "Create an account to keep your notebooks, sources, and artifacts AND ME in your sync."
                : "Log in to pick up where your notebooks left off."}
            </p>
            <p className="mt-6 font-mono text-[12px] uppercase tracking-widest text-muted-c">
              answers only from your{" "}
              <span className="text-chip line-through decoration-[var(--accent)] decoration-2">
                heart
              </span>{" "}
              sources · free to start
            </p>
          </div>

          {/* ---- right: auth card ---- */}
          <div className="order-1 lg:order-2">
            <div className="rounded-lg border-2 border-line bg-surface-2 p-6 shadow-hard-lg sm:p-7">
              {/* tabs */}
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["signup", "Sign up"],
                    ["login", "Log in"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setMode(id);
                      setError(null);
                      setNotice(null);
                    }}
                    className={`rounded-md border-2 border-line px-3 py-2.5 font-mono text-[13px] font-bold transition-all duration-150 ${
                      mode === id
                        ? "bg-ink text-on-ink shadow-hard-sm"
                        : "bg-surface text-muted-c hover:-translate-y-0.5 hover:text-app"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
                {mode === "signup" && (
                  <div>
                    <label htmlFor="name" className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-muted-c">
                      Full name
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ada Lovelace"
                      className={inputCls}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-muted-c">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-muted-c">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="at least 6 characters"
                    className={inputCls}
                  />
                </div>

                {error && (
                  <p className="rounded-md border-2 border-line bg-rose-500/10 px-3 py-2.5 font-mono text-[12px] text-rose-500">
                    {error}
                  </p>
                )}
                {notice && (
                  <p className="rounded-md border-2 border-line bg-chip px-3 py-2.5 font-mono text-[12px] text-chip">
                    {notice}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="group mt-1 inline-flex items-center justify-center gap-2 rounded-md border-2 border-line bg-ink px-7 py-3.5 text-sm font-semibold text-on-ink shadow-hard-accent transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_var(--accent)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "…" : mode === "signup" ? "Create account" : "Log in"}
                  <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </form>

              {/* divider */}
              <div className="mt-6 flex items-center gap-3">
                <span className="h-0.5 flex-1 bg-[var(--border)]" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-c">or</span>
                <span className="h-0.5 flex-1 bg-[var(--border)]" />
              </div>

              {/* google */}
              <button
                type="button"
                onClick={google}
                disabled={busy}
                className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-md border-2 border-line bg-surface px-7 py-3.5 text-sm font-semibold text-app transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                <IconGoogle className="h-5 w-5" />
                {mode === "signup" ? "Sign up with Google" : "Log in with Google"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
