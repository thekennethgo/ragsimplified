import { type About, llmName } from "./about";

/** What a character's tab says about itself, in plain words and then technically. */
export type CharacterCopy = {
  role: string;
  plain: string;
  how: { intro: string; points: string[] };
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
    how: {
      intro: `A whole document is too big to search well, so I cut it into cards of about ${v(size)} characters, roughly a page of a paperback.`,
      points: [
        "I cut at headings and blank lines, so paragraphs stay whole and code blocks are never split.",
        `Each card holds up to ${v(c?.chunk_tokens)} tokens. I count a token as about ${v(c?.chars_per_token)} characters, so no extra software is needed.`,
        `Each card starts with the last ~${v(c?.overlap_tokens)} tokens of the one before, so a sentence cut at the edge still appears whole somewhere.`,
        "Each card remembers the heading it sits under.",
        `A text can be up to ${v(c?.max_text_chars)} characters long.`,
      ],
    },
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
    how: {
      intro: `I give every card a fingerprint: a list of ${v(e?.dimensions)} numbers that captures what it's about. Later, the Scout compares your question's fingerprint with these.`,
      points: [
        `All the cards go to ${v(e?.provider)}'s ${v(e?.model)} model in one batch, marked as documents (questions are marked as queries, which helps them match).`,
        "Each fingerprint also becomes a dot on the vector map, placed with the same map as the starter library, so your cards land near the cards they're similar to.",
      ],
    },
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
    how: {
      intro: "I file your cards in your own folder, so the Scout searches them along with the shared library. Your folder belongs to this browser tab only.",
      points: [
        "Your cards and fingerprints stay in this tab's memory. They're never added to the shared library or saved on our server; reload or close the tab and they're gone.",
        "When you ask a question, the browser sends them along so the Scout can search them.",
        "Your text is sent to Voyage AI to make the fingerprints, and to the language model when one of your cards is used in an answer.",
        "The shared library lives in Postgres with pgvector: each card's fingerprint is indexed (HNSW) for fast meaning search, and its words (GIN) for word search.",
      ],
    },
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

export function askTranslatorCopy(about: About | null): CharacterCopy {
  const e = about?.embedder;
  return {
    role: "turns your question into a fingerprint",
    plain:
      "I turn your question into the same kind of fingerprint as the cards, so it can be compared with them by meaning. I also work out which of your words mattered most.",
    how: {
      intro: `Computers can't compare meanings directly, so I turn your question into a fingerprint: a list of ${v(e?.dimensions)} numbers. A question and a card about the same thing get similar fingerprints, even when they use different words.`,
      points: [
        `Your question goes to ${v(e?.provider)}'s ${v(e?.model)} model, which sends back the ${v(e?.dimensions)} numbers.`,
        "To see which words mattered, I fingerprint the question again with one word left out at a time. The more the fingerprint changes, the more that word mattered; the strongest word scores 1.00.",
        `Only the first ${v(about?.translator.max_weighted_words)} words are scored, to keep it quick.`,
        "On a second look, I fingerprint the follow-up search the same way.",
      ],
    },
    tech: [`${v(e?.provider)} · ${v(e?.model)}`, "Leave-one-out word scores"],
    settings: [
      ["Model", v(e?.model)],
      ["Input type", "query"],
      ["Words scored", `first ${v(about?.translator.max_weighted_words)}`],
    ],
  };
}

export const askTranslatorSays = () => "Turning your question into numbers…";

/** The second look's bullet points for the Judge's tab, from GET /about; empty until it loads. */
export function secondLookPoints(about: About | null): string[] {
  const look = about?.second_look;
  if (!look) return [];
  if (!look.enabled) return ["The second look is off."];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const search = `The Scout searches once more and I keep the best ${look.slots} new cards, ranked against the follow-up. With the first ${v(about?.judge.keep)}, the Storyteller gets up to ${look.max_cards}.`;
  if (!look.decider)
    return [
      "Then the second look: a short language-model call decides whether the best cards are enough and, if not, writes one follow-up search.",
      search,
    ];
  return [
    `Then the second look: Mercury Decide, a small decision model, says how sure it is that the best cards fully answer your question. At ${pct(look.threshold)} or more, they go straight to the Storyteller.`,
    `If it's less than ${pct(look.nothing_threshold)} sure the cards mention anything in your question, the run stops and no answer is written.`,
    'Otherwise a short language-model call writes one follow-up search. For example, the cards say Kenneth grew up in Batam, so it searches for "Batam food".',
    search,
    "Mercury Decide checks the final cards once more; if they answer no part of the question, no answer is written.",
    "Cards from your own folder are never sent to Mercury Decide; then the language model decides alone.",
  ];
}

export function scoutCopy(about: About | null): CharacterCopy {
  const s = about?.scout;
  return {
    role: "finds likely cards",
    plain:
      "I search the cabinet two ways at once: cards whose fingerprints sit closest to your question, and cards that use the same words. Then I merge both lists into one.",
    how: {
      intro: `Think of a librarian checking two catalogues at once: one sorted by meaning, one by exact words. I take the best ${v(s?.candidates)} from each and merge them into one list.`,
      points: [
        `By meaning: the ${v(s?.candidates)} cards whose fingerprints sit closest to your question's. This finds a card about a "hometown" when you asked where someone "grew up".`,
        `By words: Postgres full-text search finds the ${v(s?.candidates)} cards that share your words ("grew" also matches "grow"). This catches names and exact terms.`,
        `Merging: each card scores 1 ÷ (${v(s?.rrf_k)} + its rank) in each list, added up, so cards near the top of both lists come first.`,
        "Cards from your own folder are searched by meaning only.",
        "On a second look, I search again for the follow-up and skip cards I already found.",
      ],
    },
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
  const look = about?.second_look;
  return {
    role: "keeps only the best",
    plain: `Search is quick but rough. I read each card next to your question, score how well it really answers it, and keep only the best ${keep}.`,
    how: {
      intro: `Search is fast but rough, so I read each of the ${v(about?.scout.candidates)} cards side by side with your question and score it from 0 to 1 for how well it answers it. Only the best ${keep} go on.`,
      points: [
        `Scoring uses ${v(r?.provider)}'s ${v(r?.model)} reranker, which reads the question and the card together. That's more accurate than comparing fingerprints, but too slow to run over the whole library.`,
        `At most ${v(about?.judge.max_per_document)} cards come from one document, so one long document can't take every place.`,
        "If the reranker is down, I keep the Scout's order, so you still get an answer.",
        ...secondLookPoints(about),
      ],
    },
    tech: [`${v(r?.provider)} · ${v(r?.model)}`, "Cross-encoder reranking", ...(look?.decider ? ["Mercury Decide"] : [])],
    settings: [
      ["Model", v(r?.model)],
      ["Cards kept", keep],
      ["If it fails", "use the Scout's order"],
      ...(look ? [["Second look", look.enabled ? `on, needs ${Math.round(look.threshold * 100)}%` : "off"] as [string, string]] : []),
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
    how: {
      intro: "I'm the only step that writes. I get your question, the numbered cards and a fixed set of rules, and write an answer that uses nothing else.",
      points: [
        `The cards go to ${name} (${v(llm?.model || undefined)}) with the rules, which you can read below.`,
        "Every fact gets the number of the card it came from, like [1]. Click a number to see the card.",
        "If the cards don't answer the question, I say so instead of guessing.",
        "Afterwards, any number that doesn't match a real card is removed, so every link points somewhere real.",
        ...(llm?.fallback_model
          ? [`If ${name} runs out of quota, the same request goes to ${llm.fallback_model} through OpenRouter.`]
          : []),
      ],
    },
    tech: [`${name} · ${v(llm?.model || undefined)}`, "Streaming", "Citation check"],
    settings: [
      ["Model", v(llm?.model || undefined)],
      [
        "Longest answer",
        llm?.max_tokens === null ? "the model's default" : `${v(llm?.max_tokens)} tokens`,
      ],
      ["Cards used", `up to ${v(about?.second_look.enabled ? about.second_look.max_cards : about?.judge.keep)}`],
    ],
  };
}

export const storytellerSays = (kept: number | null) =>
  kept === null ? "Writing your answer…" : `Writing from the best ${kept} ${kept === 1 ? "card" : "cards"}…`;
