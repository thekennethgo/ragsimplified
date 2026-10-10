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
  offline,
  examples,
}: {
  question: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
  /** The backend can't be reached, so nothing can be answered. */
  offline: boolean;
  examples?: string[];
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
      {examples && examples.length > 0 && (
        <div className={styles.examples}>
          <span>Try:</span>
          {examples.map((q) => (
            <button type="button" key={q} onClick={() => onChange(q)} disabled={busy || offline}>
              {q}
            </button>
          ))}
        </div>
      )}
      <p className={styles.count} aria-live="polite">
        {question.length} / {MAX_QUESTION_CHARS}
      </p>
      {offline && (
        <p role="status" className={styles.offline}>
          The library is offline right now, so questions can't be answered. Try again in a minute.
        </p>
      )}
      <button
        type="submit"
        className={styles.send}
        disabled={busy || offline || !question.trim()}
      >
        {busy ? "Asking…" : "Ask"}
      </button>
      <p className={styles.privacy}>Sent to Voyage AI (fingerprint) and Anthropic (answer).</p>
    </form>
  );
}
