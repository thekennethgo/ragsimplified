import { Fragment, useEffect, useRef, useState } from "react";

import type { Citation } from "../../lib/ask";
import type { ViewTarget } from "../../lib/viewer";
import styles from "./AnswerBubble.module.css";
import CitationPopover from "./CitationPopover";

const POPOVER_WIDTH = 320;

/** Split an answer into text and [n] markers; a marker is a button only if it has a source. */
export function AnswerText({
  answer,
  citations,
  onOpen,
}: {
  answer: string;
  citations: Citation[];
  onOpen: (n: number, el: HTMLElement) => void;
}) {
  const known = new Set(citations.map((c) => c.n));
  return (
    <div className={styles.text}>
      {answer
        .trim()
        .split(/\n\s*\n/)
        .map((paragraph, p) => (
          <p key={p}>
            {paragraph.split(/(\[\d+\])/).map((part, index) => {
              const match = /^\[(\d+)\]$/.exec(part);
              if (!match || !known.has(Number(match[1]))) {
                return (
                  <Fragment key={index}>
                    {part.split("\n").map((line, i) => (
                      <Fragment key={i}>
                        {i > 0 && <br />}
                        {line}
                      </Fragment>
                    ))}
                  </Fragment>
                );
              }
              const n = Number(match[1]);
              return (
                <button
                  key={index}
                  type="button"
                  className={styles.cite}
                  aria-label={`Source ${n}`}
                  onClick={(e) => onOpen(n, e.currentTarget)}
                >
                  [{n}]
                </button>
              );
            })}
          </p>
        ))}
    </div>
  );
}

/** The written answer. Pressing a [n] marker opens a popover with that source; one at a time. */
export function AnswerBubble({
  answer,
  citations,
  targetFor,
  onOpenInViewer,
}: {
  answer: string;
  citations: Citation[];
  targetFor: (citation: Citation) => ViewTarget | null;
  onOpenInViewer: (target: ViewTarget) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ n: number; left: number; top: number } | null>(null);

  // Close on a press outside the popover and the markers.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (popover.current?.contains(target) || target.closest(`.${styles.cite}`)) return;
      setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle(n: number, el: HTMLElement) {
    if (open?.n === n) {
      setOpen(null);
      return;
    }
    const width = root.current?.offsetWidth ?? POPOVER_WIDTH;
    const left = Math.min(Math.max(el.offsetLeft, 0), Math.max(width - POPOVER_WIDTH, 0));
    setOpen({ n, left, top: el.offsetTop + el.offsetHeight + 6 });
  }

  const cited = open ? citations.find((c) => c.n === open.n) : undefined;
  const target = cited ? targetFor(cited) : null;

  return (
    <div ref={root} className={styles.answer} aria-label="Answer" role="region">
      <AnswerText answer={answer} citations={citations} onOpen={toggle} />
      {open && cited && (
        <div ref={popover} style={{ display: "contents" }}>
          <CitationPopover
            citation={cited}
            style={{ left: open.left, top: open.top }}
            onClose={() => setOpen(null)}
            onOpenInViewer={
              target
                ? () => {
                    onOpenInViewer(target);
                    setOpen(null);
                  }
                : null
            }
          />
        </div>
      )}
    </div>
  );
}
