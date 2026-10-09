import Link from "next/link";
import { useEffect, useRef } from "react";

import type { Citation } from "../../lib/ask";
import styles from "./SourcesSidebar.module.css";

export function SourcesSidebar({
  citations,
  selected,
  hrefFor,
  onClose,
}: {
  citations: Citation[];
  selected: number | null;
  hrefFor: (citation: Citation) => string | null;
  onClose: () => void;
}) {
  const items = useRef<Map<number, HTMLLIElement>>(new Map());
  useEffect(() => {
    if (selected !== null) items.current.get(selected)?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  return (
    <aside className={styles.sidebar} aria-label="Sources">
      <button type="button" className={styles.close} onClick={onClose}>
        Close sources
      </button>
      <h2>Sources</h2>
      {citations.length === 0 ? (
        <p>No sources cited.</p>
      ) : (
        <ul className={styles.list}>
          {citations.map((c) => {
            const href = hrefFor(c);
            return (
              <li
                key={c.n}
                ref={(node) => {
                  if (node) items.current.set(c.n, node);
                }}
                aria-current={selected === c.n}
                className={styles.item}
              >
                <strong>[{c.n}]</strong> {c.title}
                {c.page !== null ? `, page ${c.page}` : ""}
                {c.heading ? ` (${c.heading})` : ""}{" "}
                <em>{c.source === "private" ? "your pasted text" : "starter library"}</em>
                <blockquote className={styles.snippet}>{c.snippet}</blockquote>
                {href && <Link href={href}>Open source {c.n}</Link>}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
