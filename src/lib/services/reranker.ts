import OpenAI from "openai";

/**
 * AgentRouter-backed OpenAI-compatible client.
 * The gateway only accepts Claude Code-style clients, so we send its User-Agent.
 */

const DEFAULT_BASE_URL = "https://agentrouter.org/v1";
const DEFAULT_MODEL = "deepseek-v4-flash";

/** Trim; treat empty/whitespace env values as unset so `?? default` works. */
function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Normalize the gateway base URL. A bare host like `https://agentrouter.org`
 * (no API path) silently returns EMPTY completions from the gateway — the SDK
 * appends `/chat/completions` to whatever base you give it, and the root path
 * is not a valid API endpoint. Append `/v1` only when the configured URL has
 * no path at all; any explicit path (`/v1`, `/api`, …) is respected as-is.
 */
function normalizeBaseURL(raw: string | undefined): string {
  const base = nonEmpty(raw) ?? DEFAULT_BASE_URL;
  try {
    const url = new URL(base);
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/v1";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_BASE_URL;
  }
}

export const agentrouter = new OpenAI({
  apiKey: nonEmpty(process.env.AGENTROUTER_API_KEY) ?? "missing-agentrouter-key",
  baseURL: normalizeBaseURL(process.env.AGENTROUTER_BASE_URL),
  defaultHeaders: {
    "User-Agent": "claude-cli/2.0.14 (external, cli)",
  },
});

export const CHAT_MODEL = nonEmpty(process.env.AGENTROUTER_MODEL) ?? DEFAULT_MODEL;

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
      return `[${i + 1}] id: ${c.id}\n${clipped}`
    })
    .join("\n\n---\n\n");

  const systemPrompt = `You are a precision relevance filter for a retrieval-augmented system.
You will receive a user query and a numbered list of retrieved text chunks (each with a chunk id).

Your job: score each chunk's relevance to the query, then return ONLY the ids of the
top 5 chunks that are relevant — chunks that contain information that helps answer
or cover the query. If fewer than 5 chunks are relevant, return fewer. If none are
relevant, return an empty array.

Respond with ONLY a JSON array of chunk id strings (the uuid values), ordered by
relevance (best first). No explanations, no markdown fences. Example: ["uuid-1", "uuid-2"]`;

  const userPrompt = `USER QUERY:
${query}

CANDIDATE CHUNKS:
${candidateList}

Return the JSON array of relevant chunk id strings now.`;

  let keepIds: string[] | null = null;
  try {
    const completion = await agentrouter.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0,
      // reasoning tokens count against this budget, so keep it generous
      max_tokens: 4000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const message = completion.choices?.[0]?.message;
    const raw = message?.content ?? "";
    keepIds = parseIdArray(raw, chunks);
    // reasoning models sometimes exhaust the budget before writing content —
    // the id array may still be sitting in the reasoning trace
    if (keepIds === null) {
      const reasoning = (message as { reasoning_content?: string } | undefined)?.reasoning_content ?? "";
      keepIds = parseIdArray(reasoning, chunks);
    }
    if (keepIds === null) {
      console.error("[reranker] unparsable model reply:", raw.slice(0, 200) || "(empty)");
    }
  } catch (err) {
    // reranking is an optimization — degrade to similarity order, don't fail the chat
    console.error("[reranker] falling back to similarity order:", err);
  }

  // unparsable or failed -> similarity order (never an empty context by accident)
  if (keepIds === null) return chunks.slice(0, 5);
  // the model explicitly judged nothing relevant
  if (keepIds.length === 0) return [];
  return keepIds
    .map((id) => byId.get(id))
    .filter((c): c is RetrievedChunk => Boolean(c));
}

/**
 * Pull a JSON array of ids out of the model's reply, tolerating fences/prose.
 * Returns null when no array could be found at all (vs [] for an explicit
 * empty array), and accepts both chunk uuids and 1-based chunk numbers —
 * models frequently echo the bracket numbers instead of the ids.
 */
function parseIdArray(raw: string, chunks: RetrievedChunk[]): string[] | null {
  const validIds = new Set(chunks.map((c) => c.id));

  const jsonMatch = raw.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const values = parsed.map((v) => String(v).trim());
  const ids = values.filter((v) => validIds.has(v));
  // none were uuids — if they look like 1-based chunk numbers, map them back
  if (ids.length === 0 && values.length > 0) {
    const byIndex = values
      .map((v) => /^\d+$/.test(v) ? chunks[Number(v) - 1] : undefined)
      .filter((c): c is RetrievedChunk => Boolean(c));
    if (byIndex.length > 0) return [...new Set(byIndex.map((c) => c.id))].slice(0, 5);
    return null;
  }
  return [...new Set(ids)].slice(0, 5);
}
