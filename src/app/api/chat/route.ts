import { NextResponse } from "next/server";
import { supabaseAdmin, hasServiceRole, requireUser, HttpError, getOwnedSourceIds } from "@/lib/supabase-admin";
import { getEmbeddings } from "@/lib/services/embeddings";
import { rerankChunks, agentrouter, CHAT_MODEL, type RetrievedChunk } from "@/lib/services/reranker";

export const runtime = "nodejs";
export const maxDuration = 120;

const TOP_K_VECTOR = 15;
const TOP_K_FINAL = 5;
const MAX_HISTORY_TURNS = 6; // last N messages of prior conversation
const REFUSAL_MESSAGE =
  "I don't know about this. Nothing related is stated in the sources you've attached.";

type HistoryMessage = { role: "user" | "assistant"; text: string };

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
    };
    const query = body.query?.trim();
    const sourceIds = body.sourceIds ?? [];

    if (!query) {
      return NextResponse.json({ error: "query is required." }, { status: 400 });
    }
    if (sourceIds.length === 0) {
      return NextResponse.json(
        { error: "sourceIds is required — attach at least one source." },
        { status: 400 }
      );
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

    const stream = await agentrouter.chat.completions.create({
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
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const part of stream) {
            const delta = part.choices[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } catch (err) {
          console.error("[chat] stream interrupted:", err);
          controller.enqueue(
            encoder.encode("\n\n[generation interrupted — try asking again]")
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Citation-Chunk-Ids": JSON.stringify(context.map((c) => c.id)),
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
