import { NextResponse } from "next/server";
import { supabaseAdmin, hasServiceRole, requireUser, HttpError } from "@/lib/supabase-admin";
import { parseFile, parseUrl, parseYouTube } from "@/lib/services/parsers";
import { getEmbeddings } from "@/lib/services/embeddings";
import { chunkText } from "@/lib/services/chunker";

export const runtime = "nodejs";
export const maxDuration = 300; // LlamaParse polling can take a while on big PDFs

type SourceType = "url" | "pdf" | "youtube" | "text";

const SOURCE_TYPES: SourceType[] = ["url", "pdf", "youtube", "text"];

export async function POST(req: Request) {
  try {
    if (!hasServiceRole()) {
      return NextResponse.json(
        { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    const userId = await requireUser(req);

    // accept JSON ({ sourceType, pathOrUrl, sourceId }) or
    // multipart/form-data ({ sourceType: "pdf", file, sourceId })
    const contentType = req.headers.get("content-type") ?? "";
    let sourceType: SourceType | null = null;
    let pathOrUrl = "";
    let sourceId = "";
    let fileBuffer: Buffer | null = null;
    let fileName = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      sourceType = (form.get("sourceType") as string | null) as SourceType | null;
      sourceId = (form.get("sourceId") as string | null) ?? "";
      const file = form.get("file");
      if (file instanceof File) {
        fileBuffer = Buffer.from(await file.arrayBuffer());
        fileName = file.name;
      }
    } else {
      const body = (await req.json()) as {
        sourceType?: SourceType;
        pathOrUrl?: string;
        sourceId?: string;
      };
      sourceType = body.sourceType ?? null;
      pathOrUrl = body.pathOrUrl ?? "";
      sourceId = body.sourceId ?? "";
    }

    if (!sourceType || !SOURCE_TYPES.includes(sourceType)) {
      return NextResponse.json(
        { error: `sourceType must be one of: ${SOURCE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!sourceId) {
      return NextResponse.json(
        { error: "sourceId is required — create the source row first, then ingest." },
        { status: 400 }
      );
    }
    if (sourceType === "pdf" && !fileBuffer) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (sourceType !== "pdf" && !pathOrUrl.trim()) {
      return NextResponse.json({ error: "pathOrUrl is required." }, { status: 400 });
    }

    // the source must belong to a notebook owned by the caller
    const { data: source, error: sourceError } = await supabaseAdmin
      .from("sources")
      .select("id, kind, status, notebooks!inner(id, user_id)")
      .eq("id", sourceId)
      .single();
    if (sourceError || !source) {
      return NextResponse.json({ error: "Source not found." }, { status: 404 });
    }
    const joined = source.notebooks as unknown as { user_id: string }[] | { user_id: string };
    const ownerId = Array.isArray(joined) ? joined[0]?.user_id : joined.user_id;
    if (ownerId !== userId) {
      return NextResponse.json({ error: "Not your source." }, { status: 403 });
    }

    // mark processing while we work
    await supabaseAdmin.from("sources").update({ status: "processing" }).eq("id", sourceId);

    try {
      /* 1. EXTRACT -------------------------------------------------- */
      let markdown: string;
      if (sourceType === "pdf" && fileBuffer) {
        markdown = await parseFile(fileBuffer, fileName || "document.pdf");
      } else if (sourceType === "youtube") {
        markdown = await parseYouTube(pathOrUrl);
      } else if (sourceType === "text") {
        markdown = pathOrUrl;
      } else {
        markdown = await parseUrl(pathOrUrl);
      }

      /* 2. CHUNK ---------------------------------------------------- */
      const chunks = chunkText(markdown, 800);
      if (chunks.length === 0) {
        throw new Error("Nothing readable was extracted from this source.");
      }

      /* 3. EMBED ---------------------------------------------------- */
      const embeddings = await getEmbeddings(chunks, "search_document");

      /* 4. INDEX ---------------------------------------------------- */
      // replace any previous chunks for this source (re-ingestion safe)
      await supabaseAdmin.from("chunks").delete().eq("source_id", sourceId);

      const rows = chunks.map((content, i) => ({
        source_id: sourceId,
        content,
        embedding: embeddings[i],
      }));
      const { error: insertError } = await supabaseAdmin.from("chunks").insert(rows);
      if (insertError) throw new Error(`Failed to index chunks: ${insertError.message}`);

      // upgrade the source title from the parsed content when we can
      const derivedTitle = deriveTitle(markdown);
      await supabaseAdmin
        .from("sources")
        .update({ status: "ready", ...(derivedTitle ? { title: derivedTitle } : {}) })
        .eq("id", sourceId);

      return NextResponse.json({
        sourceId,
        chunkCount: chunks.length,
        status: "ready",
        title: derivedTitle,
      });
    } catch (err) {
      await supabaseAdmin.from("sources").update({ status: "failed" }).eq("id", sourceId);
      throw err;
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Ingestion failed.";
    console.error("[ingest]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Pull a human-readable title out of parsed markdown, or null. */
function deriveTitle(markdown: string): string | null {
  const heading = markdown.match(/^#\s+(.+)$/m);
  const fromHeading = heading?.[1]?.replace(/[#*_`[\]]/g, "").trim();
  if (fromHeading && fromHeading.length > 2 && !/^youtube transcript$/i.test(fromHeading)) {
    return clip(fromHeading);
  }
  // Jina Reader prefixes "Title: ..." on the first line
  const titleLine = markdown.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
  if (titleLine && titleLine.length > 2) return clip(titleLine);
  const firstLine = markdown
    .split("\n")
    .map((l) => l.replace(/[#*_`>[\]()-]/g, "").trim())
    .find((l) => l.length > 12);
  return firstLine ? clip(firstLine) : null;
}

function clip(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
