import OpenAI from "openai";
import fs from "fs";

function env() {
  const raw = fs.readFileSync(".env.local", "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const envVars = env();
const realKey = envVars.AGENTROUTER_API_KEY;
const BASE = "https://agentrouter.org/v1";
const MODEL = "deepseek-v4-flash";

function makeClient(key) {
  return new OpenAI({
    apiKey: key ?? "missing-agentrouter-key",
    baseURL: BASE,
    defaultHeaders: { "User-Agent": "claude-cli/2.0.14 (external, cli)" },
  });
}

async function streamTest(label, key) {
  const t0 = Date.now();
  try {
    const client = makeClient(key);
    const stream = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 500,
      stream: true,
      messages: [{ role: "user", content: "Reply with exactly: hello world" }],
    });
    let acc = "";
    let finish = "?";
    try {
      for await (const part of stream) {
        const delta = part.choices?.[0]?.delta?.content;
        if (part.choices?.[0]?.finish_reason) finish = part.choices[0].finish_reason;
        if (delta) acc += delta;
      }
    } catch (iterErr) {
      console.log(`[${label}] ITERATION THREW: ${iterErr.message}`);
      return;
    }
    console.log(
      `[${label}] ok ms=${Date.now() - t0} finish=${finish} chars=${acc.length} head=${acc.slice(0, 60).replace(/\n/g, " ")}`
    );
  } catch (err) {
    console.log(`[${label}] CREATE THREW: status=${err.status} msg=${err.message.slice(0, 120)}`);
  }
}

console.log("realKey length:", realKey?.length ?? "UNDEFINED");
await streamTest("A real-key        ", realKey);
await streamTest("B fallback-key    ", "missing-agentrouter-key");
await streamTest("C undefined-key   ", undefined);
