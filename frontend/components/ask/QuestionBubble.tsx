import type { FormEvent } from "react";

import type { Word } from "../../lib/ask";
import styles from "./QuestionBubble.module.css";

export const MAX_QUESTION_CHARS = 1_000;

/** The question's words, each shaded by how much it shaped the question's vector. */
export function HighlightedWords({ words }: { words: Word[] }) {
  return (
    <p className={styles.words} aria-label="Question words by influence">
      {words.map((word, index) => {
        const influence = word.influence ?? 0;
        return (
          <mark
            key={index}
            data-influence={word.influence ?? ""}
            title={
              word.influence === null
                ? "Not weighted (long question)"
                : `Influence ${word.influence.toFixed(2)}`
            }
            style={{
              background: `rgba(122, 82, 54, ${(0.08 + influence * 0.85).toFixed(2)})`,
              color: influence > 0.55 ? "#ffffff" : "inherit",
            }}
          >
            {word.text}
          </mark>
        );
      })}
    </p>
  );
}

/** The question box: type the question here and send it to the office. */
export function QuestionBubble({
  question,
  onChange,
  onSubmit,
  busy,
}: {
  question: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
}) {
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.label}>
        Your question
        <textarea
          value={question}
          onChange={(e) => onChange(e.target.value)}
          maxLength={MAX_QUESTION_CHARS}
          rows={3}
          placeholder="e.g. How did the M1 chip change MacBook battery life?"
        />
      </label>
      <p className={styles.count} aria-live="polite">
        {question.length} / {MAX_QUESTION_CHARS}
      </p>
      <button type="submit" className={styles.send} disabled={busy || !question.trim()}>
        {busy ? "Asking…" : "Ask"}
      </button>
      <p className={styles.privacy}>Sent to Voyage AI (fingerprint) and Anthropic (answer).</p>
    </form>
  );
}
