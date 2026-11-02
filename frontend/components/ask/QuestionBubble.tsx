import { type FormEvent, useLayoutEffect, useRef } from "react";

import type { Word } from "../../lib/ask";
import styles from "./QuestionBubble.module.css";

export const MAX_QUESTION_CHARS = 1_000;

export type ExampleCard = { shelf: string; color: string; questions: string[] };

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

/** The question bar: the question and the Ask button on one row, with starter questions under it. */
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
  examples?: ExampleCard[];
}) {
  const cards = examples ?? [];
  const input = useRef<HTMLTextAreaElement>(null);
  // One line until the text wraps; the CSS caps it at 3 lines.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [question]);
  const all = cards.flatMap((card) => card.questions);
  const chips = all.slice(0, 3);
  // The cards under "Browse all topics" hold the questions that are not chips.
  const more = cards
    .map((card) => ({ ...card, questions: card.questions.filter((q) => !chips.includes(q)) }))
    .filter((card) => card.questions.length > 0);
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.bar}>
        <label className={styles.label}>
          <span className={styles.labelText}>Your question</span>
          <textarea
            ref={input}
            value={question}
            onChange={(e) => onChange(e.target.value)}
            maxLength={MAX_QUESTION_CHARS}
            rows={1}
            placeholder="e.g. Where did Kenneth grow up?"
          />
        </label>
        <button
          type="submit"
          className={styles.send}
          disabled={busy || offline || !question.trim()}
        >
          {busy ? "Asking…" : "Ask"}
        </button>
      </div>
      <p className={styles.count} aria-live="polite">
        {question.length} / {MAX_QUESTION_CHARS}
      </p>
      {offline && (
        <p role="status" className={styles.offline}>
          The library is offline right now, so questions can't be answered. Try again in a minute.
        </p>
      )}
      {chips.length > 0 && (
        <div className={styles.starters}>
          {/* Wired up in step 7.5; hidden until then. */}
          <button type="button" className={styles.example} hidden>
            ▶ See an example
          </button>
          {chips.map((q) => (
            <button
              type="button"
              key={q}
              className={styles.chip}
              onClick={() => onChange(q)}
              disabled={busy || offline}
            >
              {q}
            </button>
          ))}
          {more.length > 0 && (
            <details className={styles.browse}>
              <summary>Browse all topics</summary>
              <div
                className={styles.cards}
                role="region"
                aria-label="Suggested questions"
                tabIndex={0}
              >
                {more.map((card) => (
                  <div
                    key={card.shelf}
                    className={styles.card}
                    data-testid="shelf-card"
                    style={{ borderLeftColor: card.color }}
                  >
                    <p className={styles.shelfName}>
                      <span
                        className={styles.dot}
                        style={{ background: card.color }}
                        aria-hidden="true"
                      />
                      {card.shelf}
                    </p>
                    {card.questions.map((q) => (
                      <button
                        type="button"
                        key={q}
                        className={styles.question}
                        onClick={() => onChange(q)}
                        disabled={busy || offline}
                      >
                        <span>{q}</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </form>
  );
}
