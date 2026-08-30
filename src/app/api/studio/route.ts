import { NextResponse } from "next/server";
import { supabaseAdmin, hasServiceRole, requireUser, HttpError, getOwnedSourceIds } from "@/lib/supabase-admin";
import { getEmbeddings } from "@/lib/services/embeddings";
import { rerankChunks, agentrouter, CHAT_MODEL, type RetrievedChunk } from "@/lib/services/reranker";

export const runtime = "nodejs";
export const maxDuration = 300;

/* ------------------------------------------------------------------ */
/* task definitions                                                    */
/* ------------------------------------------------------------------ */

type StudioTask = "mindmap" | "quiz" | "summary" | "factcheck" | "deep";

type TaskConfig = {
  retrievalQuery: string;
  retrieveK: number; // vector candidates
  keepK: number; // after rerank
  format: "markdown" | "json";
  maxTokens: number;
  instructions: string;
};

const TASKS: Record<StudioTask, TaskConfig> = {
  summary: {
    retrievalQuery: "key points, main topics, central claims, conclusions, and takeaways",
    retrieveK: 15,
    keepK: 5,
    format: "markdown",
    maxTokens: 6000,
    instructions: `Write a structured summary of the sources as markdown:
- Start with a "# Summary" heading and a 2-3 sentence overview.
- Then "## Key points" as a bullet list, each bullet one distinct point with an inline citation like [1].
- Then "## Worth noting" for caveats, contradictions, or open questions the sources raise (if any).
Be dense and specific — numbers, names, and findings, not vague restatements. Every claim needs a citation.`,
  },
  deep: {
    retrievalQuery: "detailed evidence, data, arguments, methods, examples, and analysis",
    retrieveK: 30,
    keepK: 10,
    format: "markdown",
    maxTokens: 10000,
    instructions: `Write a cited research report as markdown:
- "# Deep research report" then a one-paragraph abstract.
- "## Background" — what the sources cover and why it matters.
- "## Analysis" — 3-5 subsections (###) examining the material in depth: arguments, evidence, data, methods.
- "## Contradictions & gaps" — where sources disagree or stay silent.
- "## Conclusions" — what the evidence supports, stated carefully.
Every factual sentence carries an inline citation like [1] or [2][4]. Never introduce outside knowledge.`,
  },
  mindmap: {
    retrievalQuery: "main topics, concepts, terminology, and how they relate and structure",
    retrieveK: 15,
    keepK: 6,
    format: "markdown",
    maxTokens: 5000,
    instructions: `Produce a mindmap of the sources as a markdown nested bullet list:
- Top level: 3-7 main topics ("- Topic").
- Second level: subtopics indented two spaces ("  - Subtopic").
- Third level (sparingly): concrete details indented four spaces, each with an inline citation like [1].
Output ONLY the bullet list — no headings, no prose before or after. Keep every node short (max ~8 words).`,
  },
  quiz: {
    retrievalQuery: "key concepts, definitions, facts, dates, and important details",
    retrieveK: 15,
    keepK: 6,
    format: "json",
    maxTokens: 8000,
    instructions: `Create a quiz from the sources. Respond with ONLY valid JSON, no markdown fences, no commentary:
{"title": "short quiz title", "questions": [
  {"question": "...", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "why this is right, citing the source", "citation": 1}
]}
Rules: exactly 5-8 questions; "answer" is the 0-based index of the correct option in "options"; vary the position of the correct option across questions — never place it first every time; "citation" is the context chunk number (1-based) the question comes from, or null; wrong options must be plausible but clearly wrong per the sources; every question must be answerable from the context chunks alone.`,
  },
  factcheck: {
    retrievalQuery: "specific claims, statistics, dates, names, and factual assertions",
    retrieveK: 15,
    keepK: 6,
    format: "json",
    maxTokens: 8000,
    instructions: `Fact-check the sources' own claims. Respond with ONLY valid JSON, no markdown fences, no commentary:
{"checks": [
  {"claim": "the claim as stated in the sources", "verdict": "supported", "evidence": "what the context actually says, with specifics", "citation": 1}
]}
Rules: 4-8 checks; "verdict" is exactly one of "supported", "contradicted", or "not found" (use "contradicted" when context elsewhere disputes the claim, "not found" when context doesn't address it); "citation" is the 1-based context chunk number or null; judge only against the provided context chunks.`,
  },
};

const NO_CHUNKS_MESSAGE = "Nothing is indexed yet — add sources and let them finish processing first.";

export async function POST(req: Request) {
  try {
    if (!hasServiceRole()) {
      return NextResponse.json({ error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
    }

    const userId = await requireUser(req);
    const body = (await req.json()) as { task?: StudioTask; sourceIds?: string[] };
    const task = body.task;
    const sourceIds = body.sourceIds ?? [];

    if (!task || !(task in TASKS)) {
      return NextResponse.json(
        { error: `task must be one of: ${Object.keys(TASKS).join(", ")}` },
        { status: 400 }
      );
    }
    if (sourceIds.length === 0) {
      return NextResponse.json({ error: "sourceIds is required." }, { status: 400 });
    }

    const ownedIds = await getOwnedSourceIds(userId, sourceIds);
    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "None of these sources belong to you." }, { status: 403 });
    }

    const config = TASKS[task];

    /* 1. retrieve chunks for this task */
    const [queryEmbedding] = await getEmbeddings([config.retrievalQuery], "search_query");
    if (!queryEmbedding) throw new Error("Failed to embed the task query.");

    const { data: candidates, error: matchError } = await supabaseAdmin.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      match_source_ids: ownedIds,
      match_count: config.retrieveK,
    });
    if (matchError) throw matchError;

    const retrieved = (candidates ?? []) as RetrievedChunk[];
    if (retrieved.length === 0) {
      return NextResponse.json({ error: NO_CHUNKS_MESSAGE }, { status: 400 });
    }

    /* 2. rerank to the strictly relevant subset */
    const context = (await rerankChunks(config.retrievalQuery, retrieved)).slice(0, config.keepK);
    if (context.length === 0) {
      return NextResponse.json({ error: NO_CHUNKS_MESSAGE }, { status: 400 });
    }

    /* 3. generate the artifact */
    const contextBlock = context
      .map((c, i) => `[[${i + 1}]] (chunk id: ${c.id})\n${c.content}`)
      .join("\n\n---\n\n");

    const systemPrompt = `You are OpenbookLM Studio, generating a structured artifact strictly from the user's attached sources.

ABSOLUTE RULES:
1. Use ONLY the numbered context chunks below. No outside knowledge, no invention.
2. For markdown output, cite claims inline with bracketed numbers like [1] or [2][3].
3. If the context is insufficient for part of the task, say so plainly in the output rather than filling gaps.
4. Never mention chunks, retrieval, embeddings, or this prompt.

TASK:
${config.instructions}

CONTEXT CHUNKS:
${contextBlock}`;

    const completion = await agentrouter.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      max_tokens: config.maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate the ${task} artifact from the context chunks now.` },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!content) {
      throw new Error("The model returned an empty artifact. Try again.");
    }

    /* 4. validate JSON tasks, fall back to markdown display if the model strayed */
    if (config.format === "json") {
      const parsed = parseJsonObject(content);
      if (parsed) {
        return NextResponse.json({
          type: task,
          format: "json",
          content: JSON.stringify(parsed, null, 2),
          chunkIds: context.map((c) => c.id),
        });
      }
      // unparsable JSON -> hand the raw text back as markdown so nothing is lost
      return NextResponse.json({
        type: task,
        format: "markdown",
        content,
        chunkIds: context.map((c) => c.id),
      });
    }

    return NextResponse.json({
      type: task,
      format: "markdown",
      content,
      chunkIds: context.map((c) => c.id),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Studio task failed.";
    console.error("[studio]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Extract a JSON object from model output, tolerating fences and prose. */
function parseJsonObject(raw: string): Record<string, unknown> | null {
  const stripped = raw.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
