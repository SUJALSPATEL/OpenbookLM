"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { IconArrowRight } from "@/components/icons";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);

        // GoTrue appends ?error=...&error_description=... when the handshake fails
        const oauthError =
          url.searchParams.get("error_description") ??
          url.searchParams.get("error");
        if (oauthError) throw new Error(decodeURIComponent(oauthError));

        // PKCE flow: exchange the ?code= for a session
        const code = url.searchParams.get("code");
        if (code) {
          const { error: err } = await supabase.auth.exchangeCodeForSession(code);
          if (err) throw err;
        }

        // session present (just exchanged, or implicit-flow hash) -> dashboard
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace("/dashboard");
          return;
        }
        throw new Error("No session came back from Google. Try signing in again.");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Sign-in failed. Try again."
        );
      }
    })();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-md rounded-lg border-2 border-line bg-surface-2 p-8 text-center shadow-hard-lg">
        <p className="font-mono text-[12px] uppercase tracking-widest text-muted-c">
          openbooklm · auth
        </p>
        {error ? (
          <>
            <h1 className="mt-3 font-display text-2xl uppercase leading-[1.2] tracking-tight text-app">
              That didn&apos;t work.
            </h1>
            <p className="mt-4 rounded-md border-2 border-line bg-rose-500/10 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-rose-600">
              {error}
            </p>
            <a
              href="/auth"
              className="group mt-6 inline-flex items-center justify-center gap-2 rounded-md border-2 border-line bg-ink px-6 py-3 text-sm font-semibold text-on-ink shadow-hard-accent transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_var(--accent)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_var(--accent)]"
            >
              Back to sign in
              <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </>
        ) : (
          <p className="mt-3 font-mono text-[13px] uppercase tracking-widest text-muted-c anim-blink">
            signing you in…
          </p>
        )}
      </div>
    </div>
  );
}
