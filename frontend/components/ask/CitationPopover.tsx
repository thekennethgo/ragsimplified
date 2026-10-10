import { type CSSProperties, useEffect } from "react";

import type { Citation } from "../../lib/ask";
import styles from "./CitationPopover.module.css";

/** A small card under a citation marker with that one source; Escape or ✕ closes it. */
export default function CitationPopover({
  citation,
  style,
  onClose,
  onOpenInViewer,
}: {
  citation: Citation;
  style: CSSProperties;
  onClose: () => void;
  onOpenInViewer: (() => void) | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label={`Source ${citation.n}`}
      className={styles.popover}
      style={style}
    >
      <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
        ✕
      </button>
      <p className={styles.head}>
        <strong>[{citation.n}]</strong> {citation.title}
        {citation.page !== null ? `, page ${citation.page}` : ""}
        {citation.heading ? ` (${citation.heading})` : ""}
      </p>
      <p className={styles.source}>
        {citation.source === "private" ? "your pasted text" : "starter library"}
      </p>
      <blockquote className={styles.snippet}>{citation.snippet}</blockquote>
      {onOpenInViewer && (
        <button type="button" className={styles.open} onClick={onOpenInViewer}>
          Open in viewer
        </button>
      )}
    </div>
  );
}
