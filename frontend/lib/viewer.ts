/** A document to read in the Ask page's Viewer tab, and optionally the chunk to highlight. */
export type ViewTarget =
  | { kind: "library"; id: number; chunk: number | null }
  | { kind: "private"; index: number; chunk: number | null };
