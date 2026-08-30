import { NextResponse } from "next/server";
import { supabaseAdmin, hasServiceRole, requireUser, HttpError } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/chunks?id=<uuid> — returns one indexed chunk (content + its source
 * title) for the citation popover. Ownership enforced through the source's
 * notebook.
 */
export async function GET(req: Request) {
  try {
    if (!hasServiceRole()) {
      return NextResponse.json({ error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
    }

    const userId = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query param is required." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("chunks")
      .select("id, content, sources!inner(title, notebooks!inner(user_id))")
      .eq("id", id)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Chunk not found." }, { status: 404 });
    }

    const sources = data.sources as unknown as
      | { title: string; notebooks: { user_id: string }[] | { user_id: string } }[]
      | { title: string; notebooks: { user_id: string }[] | { user_id: string } };
    const src = Array.isArray(sources) ? sources[0] : sources;
    const notebooks = Array.isArray(src?.notebooks) ? src.notebooks[0] : src?.notebooks;
    if (notebooks?.user_id !== userId) {
      return NextResponse.json({ error: "Not your chunk." }, { status: 403 });
    }

    return NextResponse.json({
      id: data.id,
      content: data.content,
      sourceTitle: src?.title ?? "source",
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Chunk fetch failed.";
    console.error("[chunks]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
