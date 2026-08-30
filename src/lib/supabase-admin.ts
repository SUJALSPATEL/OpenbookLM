import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS — use exclusively in API routes / server utilities,
 * never expose anything built on this to the client bundle.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
}

export const supabaseAdmin = createClient(url, serviceKey || "missing-service-role-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** True when the service role key is configured (guards routes that need it). */
export const hasServiceRole = () => Boolean(serviceKey && serviceKey.length > 0);

/**
 * Verify the caller's JWT from an incoming request and return the user id.
 * Throws with a client-safe message when the token is absent or invalid.
 */
export async function requireUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    throw new HttpError(401, "Missing authorization token. Sign in first.");
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, "Invalid or expired session. Sign in again.");
  }
  return data.user.id;
}

/** Error carrying an HTTP status safe to surface to the client. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Filter sourceIds down to those belonging to notebooks owned by the user.
 * Returns [] when none of the ids are theirs.
 */
export async function getOwnedSourceIds(
  userId: string,
  sourceIds: string[]
): Promise<string[]> {
  if (sourceIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("sources")
    .select("id, notebooks!inner(user_id)")
    .in("id", sourceIds);
  if (error) throw error;
  return (data ?? [])
    .filter((row) => {
      const joined = row.notebooks as unknown as { user_id: string }[] | { user_id: string };
      const ownerId = Array.isArray(joined) ? joined[0]?.user_id : joined.user_id;
      return ownerId === userId;
    })
    .map((row) => row.id);
}
