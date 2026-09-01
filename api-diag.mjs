import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = (() => {
  const out = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
})();

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SERVICE);
const { data: signInData, error: signInErr } = await sb.auth.signInWithPassword({
  email: "e2e-test@openbooklm.local",
  password: "E2eTest!2026x",
});
console.log("signin:", signInErr ? `ERR ${signInErr.message}` : `ok ${signInData.user.id}`);

const { data: { session } } = await sb.auth.getSession();
const jwt = session.access_token;
fs.writeFileSync(process.env.HOME + "/e2e-token.txt", jwt);

// fixed source id from memory — the URL source (Photovoltaics), owned by e2e user
const SRC = "55555555-5555-5555-5555-555555555555";

async function post(path, body) {
  const t0 = Date.now();
  let res;
  try {
    res = await fetch("https://openbook-lm.vercel.app" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}`, apikey: ANON },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.log(`\n=== DEPLOYED ${path} -> NETWORK ERROR: ${e.message} ===`);
    return;
  }
  const text = await res.text();
  console.log(`\n=== DEPLOYED ${path} -> ${res.status} (${Date.now() - t0}ms) ===`);
  console.log(text.slice(0, 2000));
}

await post("/api/studio", { task: "summary", sourceIds: [SRC] });
await post("/api/chat", { query: "What is this source about?", sourceIds: [SRC] });
