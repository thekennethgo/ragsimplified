export type Citation = {
  n: number;
  source: "library" | "private";
  title: string;
  page: number | null;
  heading: string | null;
  snippet: string;
  document_id: number | null;
  position: number;
};

/** One word of the question and how much it shaped the question's vector (0 to 1). */
export type Word = { text: string; influence: number | null };

export type StepState = "waiting" | "working" | "done" | "error";

/** One candidate the Scout found (the "scout" step's done event). */
export type ScoutResult = {
  rank: number;
  source: "library" | "private";
  document_id: number | null;
  title: string;
  position: number;
  page: number | null;
  heading: string | null;
  score: number;
  found_by: "vector" | "keyword" | "both";
};

/** One candidate with the Judge's verdict (the "judge" step's done event). */
export type JudgeResult = {
  n: number | null;
  kept: boolean;
  old_rank: number;
  new_rank: number;
  rerank_score: number | null;
  source: "library" | "private";
  document_id: number | null;
  title: string;
  position: number;
  page: number | null;
  heading: string | null;
};

/** One card handed to the Storyteller, in citation order, and the round that found it. */
export type FinalCard = {
  n: number;
  round: 1 | 2;
  source: "library" | "private";
  document_id: number | null;
  title: string;
  position: number;
  page: number | null;
  heading: string | null;
};

/** The second look's check (the "second_look" step's done event). */
export type Look = {
  query: string | null;
  enough: number | null;
  decidedBy: "decider" | "llm";
};

/** The Translator's second page: the Clerk's follow-up query, fingerprinted. */
export type TranslatorRound2 = { query: string };

/** The Scout's second page. */
export type ScoutRound2 = { query: string; skipped: number; results: ScoutResult[] };

/** The Judge's second page: the new cards' verdicts and the five that go to the Storyteller. */
export type JudgeRound2 = { query: string; results: JudgeResult[]; finalCards: FinalCard[] };
