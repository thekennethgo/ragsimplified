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
