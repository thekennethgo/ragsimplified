import { type About, llmName } from "./about";

/** What a character's tab says about itself, in plain words and then technically. */
export type CharacterCopy = {
  role: string;
  plain: string;
  how: string;
  tech: string[];
  settings: [string, string][];
};

/** A value from /about, or "…" while it loads or if it failed. */
const v = (value: string | number | undefined): string => (value === undefined ? "…" : String(value));

/** "5 cards" or "1 card". */
const cards = (count: number) => `${count} ${count === 1 ? "card" : "cards"}`;

/** A title cut to 24 characters, with "…" when it was cut. */
export const shortTitle = (title: string) => (title.length > 24 ? `${title.slice(0, 24).trimEnd()}…` : title);

export const NOTHING_YET_UPLOAD = "Nothing yet. Send a text to see what I do with it.";
export const NOTHING_YET_ASK = "Nothing yet. Ask a question to see what I do with it.";

export function chopperCopy(about: About | null): CharacterCopy {
  const c = about?.chopper;
  const size = c ? c.chunk_tokens * c.chars_per_token : undefined;
  return {
    role: "cuts your text into cards",
    plain:
      "A whole document is too big to search well, so I cut it into cards about a page long. Each card repeats the last few lines of the one before, so no idea gets cut in half.",
    how: `The text is split at Markdown headings and blank lines into paragraphs (code blocks stay whole), then packed into chunks of up to ${v(c?.chunk_tokens)} tokens. A token is estimated as ${v(c?.chars_per_token)} characters, so no tokenizer is needed. Each chunk starts with roughly the last ${v(c?.overlap_tokens)} tokens of the one before, cut at a word boundary, and remembers the heading it sits under.`,
    tech: ["Python", "Own chunker (chopper.py)"],
    settings: [
      ["Chunk size", `${v(c?.chunk_tokens)} tokens (~${v(size)} characters)`],
      ["Overlap", `${v(c?.overlap_tokens)} tokens`],
      ["Longest text", `${v(c?.max_text_chars)} characters`],
    ],
  };
}

export const chopperSays = (title: string) => `Cutting "${shortTitle(title)}" into cards…`;

export function uploadTranslatorCopy(about: About | null): CharacterCopy {
  const e = about?.embedder;
  return {
    role: "gives each card a fingerprint",
    plain: `I turn every card into a fingerprint: a list of ${v(e?.dimensions)} numbers that captures what it means. Cards about similar things get similar numbers, which is how the Scout can later search by meaning.`,
    how: `All the chunks go to ${v(e?.provider)}'s ${v(e?.model)} embedding model in one batch, marked as documents. It returns one ${v(e?.dimensions)}-number vector per chunk. Each vector is also flattened to a point on the vector map, using the same 2-D projection (PCA) fitted over the starter library.`,
    tech: [`${v(e?.provider)} · ${v(e?.model)}`, `${v(e?.dimensions)} dimensions`, "PCA to 2-D"],
    settings: [
      ["Model", v(e?.model)],
      ["Numbers per card", v(e?.dimensions)],
      ["Input type", "document"],
    ],
  };
}

export const uploadTranslatorSays = (count: number | null) =>
  count === null ? "Fingerprinting your cards…" : `Fingerprinting ${cards(count)}…`;

export function archivistCopy(): CharacterCopy {
  return {
    role: "files your cards in your folder",
    plain:
      "I file your cards in your own folder in the cabinet, so they get searched along with everything else. Your folder isn't part of the shared library: only this browser tab can see it.",
    how: "Your folder lives in the browser's memory: your cards and their fingerprints are never added to the shared library or stored on our server. Technically, the browser includes them with each question so the Scout can search them. The shared library lives in Supabase Postgres with pgvector: every chunk has its vector, indexed with HNSW for fast cosine search, and a full-text index (GIN) for searching by words.",
    tech: ["Browser memory (your texts)", "Supabase Postgres", "pgvector · HNSW", "Full-text · GIN"],
    settings: [
      ["Your texts kept", "this tab only"],
      ["Meaning index", "HNSW, cosine distance"],
      ["Word index", "GIN, English"],
    ],
  };
}

export const archivistSays = (count: number | null) =>
  count === null ? "Filing your cards…" : `Filing ${cards(count)} in your folder…`;

export function clerkCopy(about: About | null): CharacterCopy {
  const max = v(about?.scout.max_private_chunks);
  return {
    role: "takes your question to the team",
    plain:
      "I take your question, pin it on the board for the team, and bring the answer back to you.",
    how: `The browser sends your question to the FastAPI backend's /ask endpoint. The cards in your folder live in this tab, so the browser includes them too (up to ${max}). The backend runs each step in order and streams its progress back as one JSON event per line. Every bubble, tab and animation on this page is driven by those events.`,
    tech: ["Next.js · Vercel", "FastAPI · Render", "Streamed JSON events"],
    settings: [
      ["Endpoint", "POST /ask"],
      ["Folder cards searched per question", `up to ${max}`],
    ],
  };
}

export function askTranslatorCopy(about: About | null): CharacterCopy {
  const e = about?.embedder;
  return {
    role: "turns your question into a fingerprint",
    plain:
      "I turn your question into the same kind of fingerprint as the cards, so it can be compared with them by meaning. I also work out which of your words mattered most.",
    how: `Your question goes to ${v(e?.model)}, marked as a query, and comes back as ${v(e?.dimensions)} numbers. To score each word, the question is fingerprinted again with that word left out: the further the fingerprint moves (1 − cosine similarity), the more the word mattered. Scores are scaled so the top word is 1.00. Only the first ${v(about?.translator.max_weighted_words)} words are scored.`,
    tech: [`${v(e?.provider)} · ${v(e?.model)}`, "Leave-one-out word scores"],
    settings: [
      ["Model", v(e?.model)],
      ["Input type", "query"],
      ["Words scored", `first ${v(about?.translator.max_weighted_words)}`],
    ],
  };
}

export const askTranslatorSays = () => "Turning your question into numbers…";

export function scoutCopy(about: About | null): CharacterCopy {
  const s = about?.scout;
  return {
    role: "finds likely cards",
    plain:
      "I search the cabinet two ways at once: cards whose fingerprints sit closest to your question, and cards that use the same words. Then I merge both lists into one.",
    how: `Meaning search uses pgvector's cosine distance over the HNSW index and takes the top ${v(s?.candidates)}. Word search uses Postgres full-text search (English stemming, ranked with ts_rank_cd) and takes the top ${v(s?.candidates)}. Your own cards are compared in the server's memory. The lists are merged with reciprocal rank fusion: each card scores the sum of 1 / (${v(s?.rrf_k)} + its rank) across the lists. Ranks can be added up even though the two searches score on different scales. The best ${v(s?.candidates)} go to the Judge.`,
    tech: ["pgvector · cosine", "Postgres full-text", "Reciprocal rank fusion"],
    settings: [
      ["Cards per search", v(s?.candidates)],
      ["Fusion constant k", v(s?.rrf_k)],
      ["Sent to the Judge", v(s?.candidates)],
    ],
  };
}

export const scoutSays = () => "Searching by meaning and by words…";

export function judgeCopy(about: About | null): CharacterCopy {
  const r = about?.reranker;
  const keep = v(about?.judge.keep);
  return {
    role: "keeps only the best",
    plain: `Search is quick but rough. I read each card next to your question, score how well it really answers it, and keep only the best ${keep}.`,
    how: `The question and the ${v(about?.scout.candidates)} candidates go to ${v(r?.provider)}'s ${v(r?.model)} reranker. It reads the question and each card together (a cross-encoder), which is more accurate than comparing fingerprints but too slow to run over the whole library. The ${keep} highest-scoring cards are kept, in their new order. If the reranker fails, the Scout's order is used instead.`,
    tech: [`${v(r?.provider)} · ${v(r?.model)}`, "Cross-encoder reranking"],
    settings: [
      ["Model", v(r?.model)],
      ["Cards kept", keep],
      ["If it fails", "use the Scout's order"],
    ],
  };
}

export const judgeSays = (count: number | null, keep: number | undefined) =>
  count === null || keep === undefined
    ? "Picking the best cards…"
    : `Picking the best ${keep} of ${count}…`;

export function storytellerCopy(about: About | null): CharacterCopy {
  const llm = about?.llm;
  const name = llmName(about);
  return {
    role: "writes the answer",
    plain:
      "I write the answer using only the cards the Judge kept, and mark each fact with its card number, like [1]. If the cards don't cover your question, I say so instead of guessing.",
    how: `The kept cards are numbered and sent, with your question, to ${name} along with a fixed set of rules (the system prompt). The answer streams back word by word. Afterwards, any [n] that doesn't match a real card is removed, and every remaining number becomes a link to its source.`,
    tech: [`${name} · ${v(llm?.model || undefined)}`, "Streaming", "Citation check"],
    settings: [
      ["Model", v(llm?.model || undefined)],
      [
        "Longest answer",
        llm?.max_tokens === null ? "the model's default" : `${v(llm?.max_tokens)} tokens`,
      ],
      ["Cards used", `up to ${v(about?.judge.keep)}`],
    ],
  };
}

export const storytellerSays = (kept: number | null) =>
  kept === null ? "Writing your answer…" : `Writing from the best ${kept} ${kept === 1 ? "card" : "cards"}…`;
