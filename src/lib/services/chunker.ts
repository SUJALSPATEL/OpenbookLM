/**
 * Structural markdown chunking.
 *
 * Strategy: split on markdown headings first (sections stay together),
 * then on blank lines (paragraphs), then pack paragraphs into chunks of
 * roughly `targetChars`, never splitting mid-sentence unless a single
 * sentence exceeds the target.
 */
export function chunkText(markdown: string, targetChars = 800): string[] {
  const sections = splitOnHeadings(markdown);

  const chunks: string[] = [];
  for (const section of sections) {
    const paragraphs = section
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    let current = "";
    for (const paragraph of paragraphs) {
      const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

      if (candidate.length <= targetChars) {
        current = candidate;
        continue;
      }

      // paragraph fits alone or overflows -> close out current first
      if (current) {
        chunks.push(current);
        current = "";
      }

      if (paragraph.length <= targetChars) {
        current = paragraph;
      } else {
        for (const piece of splitLongParagraph(paragraph, targetChars)) {
          if (current && `${current}\n\n${piece}`.length <= targetChars) {
            current = `${current}\n\n${piece}`;
          } else {
            if (current) chunks.push(current);
            current = piece;
          }
        }
      }
    }
    if (current) chunks.push(current);
  }

  return chunks.filter((c) => c.trim().length > 0);
}

/** Split into sections at markdown headings (heading stays with its section). */
function splitOnHeadings(markdown: string): string[] {
  const lines = markdown.split("\n");
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line.trim())) {
      if (current.some((l) => l.trim())) sections.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.some((l) => l.trim())) sections.push(current.join("\n"));
  return sections.length > 0 ? sections : [markdown];
}

/** Break an oversized paragraph on sentence boundaries. */
function splitLongParagraph(paragraph: string, targetChars: number): string[] {
  const sentences = paragraph.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [paragraph];
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (candidate.length <= targetChars) {
      current = candidate;
    } else {
      if (current) pieces.push(current);
      // a single sentence longer than the target gets hard-split
      if (sentence.length > targetChars) {
        for (let i = 0; i < sentence.length; i += targetChars) {
          pieces.push(sentence.slice(i, i + targetChars).trim());
        }
        current = "";
      } else {
        current = sentence.trim();
      }
    }
  }
  if (current) pieces.push(current);
  return pieces.filter(Boolean);
}
