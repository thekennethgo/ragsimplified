"use client";

import { useRef } from "react";

import { useAbout } from "../../lib/about";
import type { Citation } from "../../lib/ask";
import type { ViewTarget } from "../../lib/viewer";
import DocViewer from "../viewer/DocViewer";
import { AnswerBubble } from "./AnswerBubble";
import styles from "./AnswerCard.module.css";

/** The answer with its sources and, under them, the cited passage in full. */
export default function AnswerCard({
  answer,
  citations,
  askedQuestion,
  started,
  progress,
  cardsFound,
  kept,
  targetFor,
  source,
  onSource,
}: {
  answer: string;
  citations: Citation[];
  askedQuestion: string;
  /** A run has begun, so "working" can replace the empty-state hint. */
  started: boolean;
  /** The live line shown instead of the answer until it is revealed. */
  progress: string;
  /** The Scout's candidates and the Judge's keepers, for the meta line. */
  cardsFound: number;
  kept: number;
  targetFor: (citation: Citation) => ViewTarget | null;
  /** The passage open under the sources, if any. */
  source: ViewTarget | null;
  onSource: (target: ViewTarget | null) => void;
}) {
  const about = useAbout();
  // The link that opened the viewer, so Close can hand focus back to it.
  const opener = useRef<HTMLElement | null>(null);
  const marker = useRef<HTMLElement | null>(null);

  function close() {
    onSource(null);
    opener.current?.focus();
  }

  return (
    <div className={`panel ${styles.root}`} role="group" aria-label="Answer card">
      <h2>Answer</h2>
      <div className={styles.answerTab}>
        <div
          className={styles.answerCol}
          onClickCapture={(e) => {
            // Remember which [n] marker was pressed; its popover's button is gone by the time it opens the viewer.
            const el = (e.target as Element).closest<HTMLElement>('button[aria-label^="Source "]');
            if (el && !el.closest('[role="dialog"]')) marker.current = el;
          }}
        >
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
                onOpenInViewer={(t) => {
                  opener.current = marker.current;
                  onSource(t);
                }}
              />
              <p className={styles.meta}>
                {cardsFound} cards found · {kept} kept · {about?.llm.model || "…"}
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
                      <span className={styles.mono}>card {c.position + 1}</span>
                    </div>
                    <p className={styles.snippet}>{c.snippet}</p>
                    {t && (
                      <button
                        type="button"
                        aria-label={`Open source ${c.n}`}
                        onClick={(e) => {
                          opener.current = e.currentTarget;
                          onSource(t);
                        }}
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
      {source && (
        <section aria-label="Source viewer" className={styles.viewer}>
          <div className={styles.viewerHead}>
            <h3>The cited passage</h3>
            <button type="button" onClick={close}>
              Close
            </button>
          </div>
          <DocViewer target={source} />
        </section>
      )}
    </div>
  );
}
