"use client";

import { useEffect, useRef } from "react";

import { usePrivateTexts } from "../../lib/PrivateTexts";
import { newText } from "../../lib/overlap";
import styles from "./DocViewer.module.css";
import Markdown from "./Markdown";

/** One of the visitor's pasted texts in full, with the cited passage marked and scrolled into view. */
export default function PrivateTextView({
  index,
  chunk: chunkPosition,
  scrollBlock,
}: {
  index: number;
  chunk: number | null;
  scrollBlock?: ScrollLogicalPosition;
}) {
  const { texts } = usePrivateTexts();
  const citedRef = useRef<HTMLDivElement | null>(null);

  const item = texts[index];
  const chunk = item?.chunks.find((c) => c.position === chunkPosition);

  useEffect(() => {
    citedRef.current?.scrollIntoView?.({ block: scrollBlock ?? "center" });
  }, [item, chunk, scrollBlock]);

  function download() {
    if (!item) return;
    const blob = new Blob([item.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.title.slice(0, 60).replace(/[^a-zA-Z0-9]/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!item) {
    return <p>This text is not in this browser session. Pasted texts are lost when you refresh.</p>;
  }

  return (
    <div className={styles.reader}>
      <header className={styles.card}>
        <h1>{item.title}</h1>
        <p>Your pasted text, kept only in this browser.</p>
        <div className={styles.buttons}>
          <button type="button" className={styles.button} onClick={download}>
            Download
          </button>
        </div>
      </header>
      {item.chunks.map((c, index) => {
        const isCited = c === chunk;
        return (
          <div
            key={c.position}
            ref={isCited ? citedRef : undefined}
            aria-current={isCited || undefined}
            className={isCited ? `${styles.chunk} ${styles.cited}` : styles.chunk}
          >
            {isCited && <span className={styles.tag}>Cited</span>}
            <div className={styles.body}>
              <Markdown>{newText(item.chunks[index - 1]?.text, c.text)}</Markdown>
            </div>
          </div>
        );
      })}
    </div>
  );
}
