import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client with cookie-based auth storage.
 *
 * PKCE's code verifier is written to a cookie (not localStorage), which is what
 * lets the /auth/callback ROUTE HANDLER exchange ?code= for a session
 * server-side — no client/route race over who consumes the code.
 *
 * Only import this from Client Components.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
