const MAX_OVERLAP = 400;
const MIN_OVERLAP = 20;

/**
 * The part of a chunk that is new, dropping the overlap it shares with the end of the previous
 * chunk. A short accidental match (under 20 characters, unless it is the whole previous chunk)
 * is not treated as overlap.
 */
export function newText(prev: string | undefined, text: string): string {
  if (!prev) return text;
  for (let k = Math.min(prev.length, text.length, MAX_OVERLAP); k > 0; k--) {
    if (text.startsWith(prev.slice(-k))) {
      return k >= MIN_OVERLAP || k === prev.length ? text.slice(k).trimStart() : text;
    }
  }
  return text;
}
