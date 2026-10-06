import type { FormEvent } from "react";

import type { Word } from "../../lib/ask";

export const MAX_QUESTION_CHARS = 1_000;

/** The question's words, each shaded by how much it shaped the question's vector. */
export function HighlightedWords({ words }: { words: Word[] }) {
  return (
    <p className="question-words" aria-label="Question words by influence">
      {words.map((word, index) => (
        <span key={index}>
          <mark
            data-influence={word.influence ?? ""}
            title={
              word.influence === null
                ? "Not weighted (long question)"
                : `Influence ${word.influence.toFixed(2)}`
            }
            style={{
              background: `rgba(255, 193, 7, ${word.influence ?? 0})`,
              color: "inherit",
            }}
          >
            {word.text}
          </mark>{" "}
        </span>
      ))}
    </p>
  );
}

/** The text bubble above the Translator: type the question here, then see its words weighed. */
export function QuestionBubble({
  question,
  onChange,
  onSubmit,
  busy,
  words,
}: {
  question: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
  words: Word[];
}) {
  return (
    <form className="bubble question-bubble" onSubmit={onSubmit}>
      <label>
        Question
        <textarea
          value={question}
          onChange={(e) => onChange(e.target.value)}
          maxLength={MAX_QUESTION_CHARS}
          rows={3}
        />
      </label>
      <p aria-live="polite">
        {question.length} / {MAX_QUESTION_CHARS}
      </p>
      <button type="submit" disabled={busy || !question.trim()}>
        {busy ? "Working…" : "Ask"}
      </button>
      {words.length > 0 && <HighlightedWords words={words} />}
    </form>
  );
}
