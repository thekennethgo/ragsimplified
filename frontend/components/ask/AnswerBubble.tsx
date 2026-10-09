import { Fragment } from "react";

import type { Citation } from "../../lib/ask";
import styles from "./AnswerBubble.module.css";

/** Split an answer into text and [n] markers; a marker is a button only if it has a source. */
export function AnswerText({
  answer,
  citations,
  onOpen,
}: {
  answer: string;
  citations: Citation[];
  onOpen: (n: number) => void;
}) {
  const known = new Set(citations.map((c) => c.n));
  return (
    <p className={styles.text}>
      {answer.split(/(\[\d+\])/).map((part, index) => {
        const match = /^\[(\d+)\]$/.exec(part);
        if (!match || !known.has(Number(match[1]))) {
          return <Fragment key={index}>{part}</Fragment>;
        }
        const n = Number(match[1]);
        return (
          <button
            key={index}
            type="button"
            className={styles.cite}
            aria-label={`Source ${n}`}
            onClick={() => onOpen(n)}
          >
            [{n}]
          </button>
        );
      })}
    </p>
  );
}

/** The written answer. Pressing it (or "Show sources") opens the citations sidebar. */
export function AnswerBubble({
  answer,
  citations,
  onOpenSource,
  onShowSources,
}: {
  answer: string;
  citations: Citation[];
  onOpenSource: (n: number) => void;
  onShowSources: () => void;
}) {
  return (
    <div className={styles.answer} aria-label="Answer" role="region" onClick={onShowSources}>
      <AnswerText answer={answer} citations={citations} onOpen={onOpenSource} />
      {answer && (
        <button
          type="button"
          className={styles.show}
          onClick={(e) => {
            e.stopPropagation();
            onShowSources();
          }}
        >
          Show sources
        </button>
      )}
    </div>
  );
}
