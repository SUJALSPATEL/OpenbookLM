import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY ?? "missing-cohere-key" });

const EMBED_MODEL = "embed-english-v3.0";
const EMBED_DIMENSIONS = 1024;
const MAX_BATCH = 96; // Cohere's per-request input limit

export type EmbedInputType = "search_document" | "search_query";

/**
 * Embed text chunks with Cohere embed-english-v3.0 (1024 dims).
 * Automatically batches past Cohere's 96-input request limit.
 */
export async function getEmbeddings(
  textChunks: string[],
  inputType: EmbedInputType
): Promise<number[][]> {
  if (textChunks.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < textChunks.length; i += MAX_BATCH) {
    batches.push(textChunks.slice(i, i + MAX_BATCH));
  }

  const results: number[][] = [];
  for (const batch of batches) {
    const response = await cohere.v2.embed({
      model: EMBED_MODEL,
      texts: batch,
      inputType,
      embeddingTypes: ["float"],
    });
    const vectors = response.embeddings.float;
    if (!vectors) throw new Error("Cohere returned no embeddings");
    for (const vector of vectors) {
      if (vector.length !== EMBED_DIMENSIONS) {
        throw new Error(
          `Cohere returned ${vector.length} dimensions, expected ${EMBED_DIMENSIONS}`
        );
      }
      results.push(vector);
    }
  }
  return results;
}
