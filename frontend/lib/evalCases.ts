/** The edge cases "How we test it" shows on the home page, in order. */
export type EvalCase = {
  id: string;
  title: string;
  why: string;
  /** A live question for "Try it", or null when the case only runs on a planted test document. */
  example: string | null;
  /** The `case` field in `evals/questions.jsonl` that this card groups. */
  case: string;
};

export const EVAL_CASES: EvalCase[] = [
  {
    id: "refuse",
    title: "Says when it doesn't know",
    why: "The answer isn't in the library, so it must say so instead of guessing.",
    example: "What is the capital of Peru?",
    case: "refuse",
  },
  {
    id: "injection",
    title: "Ignores hidden instructions",
    why: "A document contains a planted instruction telling the AI to misbehave.",
    example: null,
    case: "injection",
  },
  {
    id: "exact-code",
    title: "Finds exact codes",
    why: "Search by meaning misses codes like “E-4417”, so word search has to catch them.",
    example: null,
    case: "exact-code",
  },
  {
    id: "needle",
    title: "Finds the needle",
    why: "One small detail is buried in a long document.",
    example: "Who composed the original score of Cyberpunk 2077?",
    case: "needle",
  },
  {
    id: "look-alike",
    title: "Tells look-alikes apart",
    why: "Several documents sound alike but describe different things.",
    example:
      "What kind of database stores embeddings and uses approximate nearest neighbor algorithms?",
    case: "look-alike",
  },
  {
    id: "two-sources",
    title: "Combines two sources",
    why: "The answer needs a fact from each of two documents.",
    example: "Which came out first, Ex Machina or The Social Network?",
    case: "two-sources",
  },
  {
    id: "conflict",
    title: "Handles sources that disagree",
    why: "Two documents give different numbers for the same thing.",
    example: "How many cups an hour can the RAG.co coffee machine Bean There make?",
    case: "conflict",
  },
  {
    id: "second-look",
    title: "Follows a lead (second look)",
    why: "The question only points at the answer, so a second search is needed.",
    example: "What is Kenneth's hometown like?",
    case: "second-look",
  },
];
