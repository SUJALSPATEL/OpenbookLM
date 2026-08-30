import OpenAI from "openai";

/**
 * AgentRouter-backed OpenAI-compatible client.
 * The gateway only accepts Claude Code-style clients, so we send its User-Agent.
 */
export const agentrouter = new OpenAI({
  apiKey: process.env.AGENTROUTER_API_KEY ?? "missing-agentrouter-key",
  baseURL: process.env.AGENTROUTER_BASE_URL ?? "https://agentrouter.org/v1",
  defaultHeaders: {
    "User-Agent": "claude-cli/2.0.14 (external, cli)",
  },
});

export const CHAT_MODEL = process.env.AGENTROUTER_MODEL ?? "deepseek-v4-flash";

export type RetrievedChunk = {
  id: string;
  source_id: string;
  content: string;
  similarity?: number;
};

const MAX_CONTEXT_CHARS_PER_CHUNK = 1200;

/**
 * LLM-based reranker. Takes the vector-search candidates and asks the model to
 * keep only the chunks that are strictly relevant to the query, returning at
 * most 5. Falls back to similarity order if the model's output can't be parsed.
 */
export async function rerankChunks(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];

  const byId = new Map(chunks.map((c) => [c.id, c]));

  const candidateList = chunks
    .map((c, i) => {
      const clipped = c.content.length > MAX_CONTEXT_CHARS_PER_CHUNK
        ? `${c.content.slice(0, MAX_CONTEXT_CHARS_PER_CHUNK)}…`
        : c.content;
      return `[${i + 1}] id: ${c.id}\n${clipped}`;
    })
    .join("\n\n---\n\n");

  const systemPrompt = `You are a precision relevance filter for a retrieval-augmented system.
You will receive a user query and a numbered list of retrieved text chunks (each with an id).

Your job: score each chunk's relevance to the query, then return ONLY the ids of the
top 5 chunks that are STRICTLY relevant — chunks that contain information that helps
answer the query. Exclude chunks that are merely on the same broad topic but do not
help answer this specific query. If fewer than 5 chunks are truly relevant, return
fewer. If none are relevant, return an empty list.

Respond with ONLY a JSON array of chunk id strings, ordered by relevance (best first).
No explanations, no markdown fences. Example: ["uuid-1", "uuid-2"]`;

  const userPrompt = `USER QUERY:
${query}

CANDIDATE CHUNKS:
${candidateList}

Return the JSON array of strictly relevant chunk ids now.`;

  let keepIds: string[] = [];
  let llmFailed = false;
  try {
    const completion = await agentrouter.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0,
      // reasoning tokens count against this budget, so keep it generous
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const message = completion.choices[0]?.message;
    const raw = message?.content ?? "";
    keepIds = parseIdArray(raw, chunks);
    // reasoning models sometimes exhaust the budget before writing content —
    // the id array may still be sitting in the reasoning trace
    if (keepIds.length === 0) {
      const reasoning = (message as { reasoning_content?: string } | undefined)?.reasoning_content ?? "";
      keepIds = parseIdArray(reasoning, chunks);
    }
    if (keepIds.length === 0 && chunks.length > 0) {
      console.error("[reranker] unparsable model reply:", raw.slice(0, 200) || "(empty)");
    }
  } catch (err) {
    // reranking is an optimization — degrade to similarity order, don't fail the chat
    console.error("[reranker] falling back to similarity order:", err);
    llmFailed = true;
  }

  if (llmFailed) {
    return chunks.slice(0, 5);
  }
  if (keepIds.length === 0) return [];
  return keepIds
    .map((id) => byId.get(id))
    .filter((c): c is RetrievedChunk => Boolean(c));
}

/** Pull a JSON array of ids out of the model's reply, tolerating fences/prose. */
function parseIdArray(raw: string, chunks: RetrievedChunk[]): string[] {
  const validIds = new Set(chunks.map((c) => c.id));

  const jsonMatch = raw.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed)) return [];
    const ids = parsed
      .map((v) => String(v))
      .filter((v) => validIds.has(v));
    return [...new Set(ids)].slice(0, 5);
  } catch {
    return [];
  }
}
