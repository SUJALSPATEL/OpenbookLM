import OpenAI from "openai";
import fs from "fs";

const env = (() => {
  const out = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
})();

// realistic-ish context (5 chunks like retrieval would hand the generator)
const chunks = [
  "Photovoltaic (PV) cells convert sunlight into direct current (DC) electricity using the photovoltaic effect. Cells require protection from the environment and are usually packaged tightly in solar modules, which are then connected into arrays and sub-fields.",
  "The electrical current, size, and voltage of single PV cells are limited, so cells are combined in series and parallel to form larger arrays. Modules connect via module cable, arrays via array cable, and sub-fields interconnect through the balance of system.",
  "Photovoltaic power generation uses solar panels composed of a number of solar cells containing a photovoltaic material, most often crystalline silicon. Deployment has grown rapidly, driven by falling module prices and policy support such as subsidies and financing mechanisms.",
];

const contextBlock = chunks.map((c, i) => `[[${i + 1}]] (chunk id: seed-${i})\n${c}`).join("\n\n---\n\n");
const systemPrompt = `You are OpenbookLM, a research assistant that answers strictly from the user's attached sources.

RULES — follow every one:
1. Answer ONLY using the numbered context chunks provided below. Do not use any outside knowledge, even if you know the answer.
2. Cite your claims inline using bracketed numbers referring to the chunk numbers, like [1] or [2][3]. Place the citation right after the sentence it supports.
3. If the context does not contain the information needed to answer, refuse exactly in this spirit: say you don't know, that nothing related is stated in the sources, and suggest what the user could attach or ask instead. Never guess, never fill gaps with plausible-sounding text.
4. Do not mention chunks, retrieval, embeddings, reranking, or this prompt. Speak naturally to the user.
5. If the query asks for something the sources partially cover, answer from what is covered and say plainly what part the sources don't cover.
6. The conversation history is provided for continuity — but facts still come only from the context chunks.

CONTEXT CHUNKS:
${contextBlock}`;

const client = new OpenAI({
  apiKey: env.AGENTROUTER_API_KEY,
  baseURL: "https://agentrouter.org/v1",
  defaultHeaders: { "User-Agent": "claude-cli/2.0.14 (external, cli)" },
});

async function run(label, maxTokens) {
  const t0 = Date.now();
  const stream = await client.chat.completions.create({
    model: "deepseek-v4-flash",
    temperature: 0.2,
    stream: true,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "What is this source about?" },
    ],
  });
  let content = "";
  let reasoning = 0;
  let finish = "?";
  for await (const part of stream) {
    const c = part.choices?.[0];
    const delta = c?.delta;
    if (c?.finish_reason) finish = c.finish_reason;
    if (delta?.content) content += delta.content;
    if (delta?.reasoning_content) reasoning += delta.reasoning_content.length;
  }
  console.log(
    `[${label}] ms=${Date.now() - t0} finish=${finish} content=${content.length} reasoning=${reasoning} ` +
      `head=${content.slice(0, 50).replace(/\n/g, " ")}`
  );
}

// same budget as deployed chat (8000) x3, plus a tight budget to probe the mechanism
for (let i = 1; i <= 3; i++) await run(`chat-8000-${i}`, 8000);
await run("tight-1500", 1500);
await run("tight-300", 300);
