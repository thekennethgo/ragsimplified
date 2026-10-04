const ANCHOR_CHARS = 60;

/**
 * Find where a chunk sits inside the original pasted text, as [start, end).
 *
 * The Chopper normalises whitespace between paragraphs, so the whole chunk may not appear
 * verbatim. Locate its first and last few words instead. Returns null if they cannot be found.
 */
export function locatePassage(text: string, chunk: string): [number, number] | null {
  const whole = text.indexOf(chunk);
  if (whole !== -1) return [whole, whole + chunk.length];

  const head = chunk.slice(0, ANCHOR_CHARS);
  const tail = chunk.slice(-ANCHOR_CHARS);
  const start = text.indexOf(head);
  if (start === -1) return null;
  const tailAt = text.indexOf(tail, start);
  if (tailAt === -1) return null;
  return [start, tailAt + tail.length];
}
