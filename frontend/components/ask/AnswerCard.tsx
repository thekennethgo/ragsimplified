"use client";

import { useAbout } from "../../lib/about";
import type { Citation } from "../../lib/ask";
import type { ViewTarget } from "../../lib/viewer";
import { AnswerBubble } from "./AnswerBubble";
import type { PartOf } from "./StepDetails";
import styles from "./AnswerCard.module.css";

/** The answer with its sources; "Open" shows the cited passage in the library viewer below. */
export default function AnswerCard({
  answer,
  citations,
  askedQuestion,
  model,
  started,
  progress,
  cardsFound,
  kept,
  targetFor,
  onOpen,
  partOf,
}: {
  partOf: PartOf;
  answer: string;
  citations: Citation[];
  askedQuestion: string;
  /** The model that wrote the answer; falls back to the configured one. */
  model?: string | null;
  /** A run has begun, so "working" can replace the empty-state hint. */
  started: boolean;
  /** The live line shown instead of the answer until it is revealed. */
  progress: string;
  /** The Scout's candidates and the Judge's keepers, for the meta line. */
  cardsFound: number;
  kept: number;
  targetFor: (citation: Citation) => ViewTarget | null;
  /** Shows the passage in the library viewer. */
  onOpen: (target: ViewTarget) => void;
}) {
  const about = useAbout();
  return (
    <div className={`panel ${styles.root}`} role="group" aria-label="Answer card">
      <h2>Answer</h2>
      <div className={styles.answerTab}>
        <div className={styles.answerCol}>
          {answer ? (
            <>
              <p className={styles.asked}>
                <span>You asked</span>
                {askedQuestion}
              </p>
              <AnswerBubble
                answer={answer}
                citations={citations}
                targetFor={targetFor}
                onOpenInViewer={onOpen}
              />
              <p className={styles.meta}>
                {cardsFound} cards found · {kept} used · {model || about?.llm.model || "…"}
              </p>
            </>
          ) : started ? (
            <p className={styles.empty}>{progress}</p>
          ) : (
            <p className={styles.empty}>Your answer shows up here, with its sources.</p>
          )}
        </div>
        {answer && (
        <section aria-labelledby="src-h" className={styles.sources}>
          <h3 id="src-h">Sources</h3>
          {citations.length > 0 ? (
            <ol>
              {citations.map((c) => {
                const t = targetFor(c);
                return (
                  <li key={c.n}>
                    <div className={styles.cardHead}>
                      <span className={styles.num}>{c.n}</span>
                      <span className={styles.name}>{c.title}</span>
                      <span className={styles.mono}>{partOf(c)}</span>
                    </div>
                    <p className={styles.snippet}>{c.snippet}</p>
                    {t && (
                      <button
                        type="button"
                        aria-label={`Open source ${c.n}`}
                        onClick={() => onOpen(t)}
                      >
                        Open
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={styles.empty}>Nothing was cited.</p>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
