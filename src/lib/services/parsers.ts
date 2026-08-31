import { YoutubeTranscript } from "youtube-transcript";

/**
 * Source parsers: every function takes raw user input and returns extracted
 * markdown. All network calls use native fetch.
 */

const LLAMA_PARSE_URL = "https://api.cloud.llamaindex.ai/api/parsing";
const JINA_READER_URL = "https://r.jina.ai";

/* ------------------------------------------------------------------ */
/* PDF / DOCX via LlamaParse                                           */
/* ------------------------------------------------------------------ */

async function llamaParse(fileBuffer: Buffer, fileName: string): Promise<string> {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) throw new Error("LLAMA_CLOUD_API_KEY is not configured");

  // 1. upload the file (route is /upload — the old /parse endpoint is gone)
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(fileBuffer)]), fileName);
  form.append("verbosity", "0");

  const uploadRes = await fetch(`${LLAMA_PARSE_URL}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      accept: "application/json",
    },
    body: form,
  });
  if (!uploadRes.ok) {
    const detail = await uploadRes.text().catch(() => "");
    throw new Error(`LlamaParse upload failed (${uploadRes.status}): ${detail.slice(0, 200)}`);
  }
  const job = (await uploadRes.json()) as { id: string };
  if (!job?.id) throw new Error("LlamaParse did not return a job id");

  // 2. poll until the job finishes (big PDFs can take a few minutes)
  const deadline = Date.now() + 240_000;
  let done = false;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(`${LLAMA_PARSE_URL}/job/${job.id}`, {
      headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
    });
    if (!statusRes.ok) continue; // transient hiccup -> keep polling
    const status = (await statusRes.json()) as { status: string };
    if (status.status === "SUCCESS") {
      done = true;
      break;
    }
    if (status.status === "ERROR" || status.status === "FAILED") {
      throw new Error("LlamaParse could not parse this file");
    }
  }
  if (!done) throw new Error("LlamaParse timed out on this file — try again");

  // 3. fetch the markdown result
  const resultRes = await fetch(`${LLAMA_PARSE_URL}/job/${job.id}/result/markdown`, {
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
  });
  if (!resultRes.ok) {
    throw new Error(`LlamaParse result fetch failed (${resultRes.status})`);
  }
  const resultText = await resultRes.text();
  // the result endpoint wraps the document in JSON: {"markdown": "...", "job_metadata": {...}}
  let markdown = resultText;
  try {
    const parsed = JSON.parse(resultText) as { markdown?: string };
    if (typeof parsed.markdown === "string") markdown = parsed.markdown;
  } catch {
    /* older/plain-text response — use it as-is */
  }
  if (!markdown.trim()) throw new Error("LlamaParse returned an empty document");
  return markdown;
}

export async function parseFile(fileBuffer: Buffer, fileName: string): Promise<string> {
  return llamaParse(fileBuffer, fileName);
}

/* ------------------------------------------------------------------ */
/* Web pages via Jina Reader                                           */
/* ------------------------------------------------------------------ */

export async function parseUrl(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  // validate after normalizing
  new URL(url);

  const res = await fetch(`${JINA_READER_URL}/${url}`, {
    headers: {
      accept: "text/plain",
      "x-return-format": "markdown",
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Could not read this URL (${res.status}): ${detail.slice(0, 200)}`);
  }
  const markdown = await res.text();
  if (!markdown.trim()) throw new Error("This URL returned no readable content");
  return markdown;
}

/* ------------------------------------------------------------------ */
/* YouTube transcripts                                                 */
/* ------------------------------------------------------------------ */

/**
 * True when the string is a real YouTube video URL (watch / shorts / embed /
 * live / youtu.be). Used to catch YouTube links pasted into the generic URL
 * source kind so they get a real transcript instead of Jina Reader's page
 * scrape. Deliberately does NOT match bare 11-char ids — that shortcut stays
 * exclusive to the dedicated YouTube kind, where a bare id is an intentional
 * input, not a URL-field mistake.
 */
export function isYouTubeUrl(input: string): boolean {
  const trimmed = input.trim();
  return [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)[\w-]{11}/i,
    /(?:youtu\.be\/)[\w-]{11}/i,
    /(?:youtube\.com\/shorts\/)[\w-]{11}/i,
    /(?:youtube\.com\/embed\/)[\w-]{11}/i,
    /(?:youtube-nocookie\.com\/embed\/)[\w-]{11}/i,
    /(?:youtube\.com\/live\/)[\w-]{11}/i,
  ].some((p) => p.test(trimmed));
}

function extractVideoId(videoUrl: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/i,
    /(?:youtu\.be\/)([\w-]{11})/i,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/i,
    /(?:youtube\.com\/embed\/)([\w-]{11})/i,
    /(?:youtube-nocookie\.com\/embed\/)([\w-]{11})/i,
    /(?:youtube\.com\/live\/)([\w-]{11})/i,
  ];
  for (const p of patterns) {
    const m = videoUrl.match(p);
    if (m) return m[1];
  }
  // allow a bare 11-char id
  if (/^[\w-]{11}$/.test(videoUrl.trim())) return videoUrl.trim();
  throw new Error("That doesn't look like a YouTube link");
}

export async function parseYouTube(
  videoUrl: string
): Promise<{ markdown: string; title: string | null }> {
  const videoId = extractVideoId(videoUrl);
  let segments: { text: string }[];
  try {
    segments = await YoutubeTranscript.fetchTranscript(videoId);
  } catch {
    throw new Error("No transcript is available for this video");
  }
  const transcript = segments
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!transcript) throw new Error("No transcript is available for this video");
  const title = await fetchVideoTitle(videoId);
  return { markdown: `# YouTube transcript\n\n${transcript}\n`, title };
}

/** Video title via the public oEmbed endpoint — no API key needed. */
async function fetchVideoTitle(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`
      )}&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return data.title?.trim() || null;
  } catch {
    return null;
  }
}
