import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // PKCE: Google returns ?code=... which exchangeCodeForSession handles
      flowType: "pkce",
      detectSessionInUrl: true,
    },
  }
);
