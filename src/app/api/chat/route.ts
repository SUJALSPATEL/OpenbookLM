import { NextResponse } from "next/server";
import { supabaseAdmin, hasServiceRole, requireUser, HttpError, getOwnedSourceIds, notebookBelongsToUser } from "@/lib/supabase-admin";
import { getEmbeddings } from "@/lib/services/embeddings";
import { rerankChunks, llm, CHAT_MODEL, type RetrievedChunk } from "@/lib/services/reranker";

export const runtime = "nodejs";
export const maxDuration = 120;

const TOP_K_VECTOR = 15;
const TOP_K_FINAL = 5;
const MAX_HISTORY_TURNS = 6; // last N messages of prior conversation
const REFUSAL_MESSAGE =
  "I don't know about this. Nothing related is stated in the sources you've attached.";

type HistoryMessage = { role: "user" | "assistant"; text: string };

/**
 * Persist a chat message with the service role (bypasses RLS — the notebook's
 * ownership is verified before this is ever called). The server owns chat
 * persistence so a flaky browser session can never silently lose history.
 */
async function saveMessage(row: {
  notebook_id: string;
  role: "user" | "assistant";
  text: string;
  flag?: string;
  citations?: string[];
}): Promise<void> {
  const { error } = await supabaseAdmin.from("chat_messages").insert(row);
  if (error) {
    // never fail the chat over a history write — but never hide it either
    console.error("[chat] could not save message:", error.message);
  }
}

export async function POST(req: Request) {
  try {
    if (!hasServiceRole()) {
      return NextResponse.json(
        { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    const userId = await requireUser(req);

    const body = (await req.json()) as {
      query?: string;
      sourceIds?: string[];
      history?: HistoryMessage[];
      notebook_id?: string;
    };
    const query = body.query?.trim();
    const sourceIds = body.sourceIds ?? [];
    const notebookId = body.notebook_id?.trim() ?? null;

    if (!query) {
      return NextResponse.json({ error: "query is required." }, { status: 400 });
    }
    if (sourceIds.length === 0) {
      return NextResponse.json(
        { error: "sourceIds is required — attach at least one source." },
        { status: 400 }
      );
    }

    // chat history is saved server-side — the notebook must be the caller's own
    const canSave = notebookId ? await notebookBelongsToUser(userId, notebookId) : false;
    if (notebookId && !canSave) {
      return NextResponse.json(
        { error: "That notebook does not belong to you." },
        { status: 403 }
      );
    }
    if (canSave) {
      await saveMessage({ notebook_id: notebookId!, role: "user", text: query });
    }

    const ownedIds = await getOwnedSourceIds(userId, sourceIds);
    if (ownedIds.length === 0) {
      return NextResponse.json(
        { error: "None of these sources belong to you." },
        { status: 403 }
      );
    }

    /* 1. SEARCH ------------------------------------------------------- */
    const [queryEmbedding] = await getEmbeddings([query], "search_query");
    if (!queryEmbedding) {
      throw new Error("Failed to embed the query.");
    }

    const { data: candidates, error: matchError } = await supabaseAdmin.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      match_source_ids: ownedIds,
      match_count: TOP_K_VECTOR,
    });
    if (matchError) throw matchError;

    const retrieved = (candidates ?? []) as RetrievedChunk[];
    if (retrieved.length === 0) {
      if (canSave) {
        await saveMessage({
          notebook_id: notebookId!,
          role: "assistant",
          text: REFUSAL_MESSAGE,
          flag: "refusal",
        });
      }
      return plainTextResponse(REFUSAL_MESSAGE);
    }

    /* 2. RERANK ------------------------------------------------------- */
    // an empty rerank falls back to similarity order — the generation model's
    // system prompt handles "nothing relevant here" refusal better than a
    // precision filter judging 800-char excerpts ever can
    let context = await rerankChunks(query, retrieved);
    if (context.length === 0) context = retrieved;
    context = context.slice(0, TOP_K_FINAL);

    /* 3. GENERATE (streamed) ------------------------------------------ */
    const contextBlock = context
      .map((c, i) => `[[${i + 1}]] (chunk id: ${c.id})\n${c.content}`)
      .join("\n\n---\n\n");

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

    const history = (body.history ?? []).slice(-MAX_HISTORY_TURNS);

    const stream = await llm.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      stream: true,
      max_tokens: 8000,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.text })),
        { role: "user", content: query },
      ],
    });

    const encoder = new TextEncoder();
    const citationIds = context.map((c) => c.id);
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let acc = "";
        let reasoning = "";
        try {
          for await (const part of stream) {
            const choice = part.choices?.[0];
            const delta = choice?.delta?.content;
            const reasonDelta = (choice?.delta as { reasoning_content?: string } | undefined)?.reasoning_content;
            if (reasonDelta) reasoning += reasonDelta;
            if (delta) {
              acc += delta;
              controller.enqueue(encoder.encode(delta));
            }
          }
          // stream ended but produced nothing visible — don't silently serve an
          // empty answer or save a blank assistant message
          if (!acc.trim()) {
            const baseURL = process.env.GEMINI_BASE_URL ?? "(unset)";
            const key = maskKey(process.env.GEMINI_API_KEY);
            if (reasoning.trim()) {
              // a thinking model can exhaust its whole token budget reasoning
              // and leave content empty. Serve the reasoning so the user gets
              // an answer instead of nothing.
              console.error(
                `[chat] content empty but reasoning present (${reasoning.length} chars) — serving reasoning. ` +
                  `model=${CHAT_MODEL}, baseURL=${baseURL}, key=${key}.`
              );
              acc = reasoning.trim();
              controller.enqueue(encoder.encode(acc));
            } else {
              // nothing at all — surface the configured values (masked key) so
              // the user can compare against .env.local without hunting logs
              console.error(
                `[chat] stream produced no content at all — model=${CHAT_MODEL}, ` +
                  `baseURL=${baseURL}, key=${key}. ` +
                  `Check GEMINI_MODEL / GEMINI_BASE_URL / GEMINI_API_KEY.`
              );
              controller.enqueue(
                encoder.encode(
                  `[The model returned nothing. Config: baseURL=${baseURL}, model=${CHAT_MODEL}, ` +
                    `key=${key}. If key=${key} does not match the GEMINI_API_KEY in your ` +
                    `local .env.local, paste the correct one into the Vercel env and redeploy.]`
                )
              );
            }
          }
        } catch (err) {
          console.error("[chat] stream interrupted:", err);
          controller.enqueue(
            encoder.encode("\n\n[generation interrupted — try asking again]")
          );
        } finally {
          controller.close();
          // the finished answer is persisted server-side, citations and all —
          // saving here (not in the browser) is what makes history survive
          if (canSave && acc.trim()) {
            await saveMessage({
              notebook_id: notebookId!,
              role: "assistant",
              text: acc.trim(),
              citations: citationIds,
            });
          }
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Citation-Chunk-Ids": JSON.stringify(citationIds),
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Chat failed.";
    console.error("[chat]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function plainTextResponse(text: string): Response {
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Mask an API key so diagnostics reveal whether the deployed key matches the
 *  local one (first/last 4 chars only — never the full secret). */
function maskKey(raw: string | undefined): string {
  const key = raw?.trim();
  if (!key) return "(unset)";
  if (key.length <= 8) return `(${key.length} chars)`;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
