"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { pdfFiles } from "../../lib/pdfFiles";
import { usePrivateTexts } from "../../lib/PrivateTexts";
import { newText } from "../../lib/overlap";
import styles from "./DocViewer.module.css";
import Markdown from "./Markdown";

const PdfView = dynamic(() => import("./PdfView"), {
  ssr: false,
  loading: () => <p>Loading the PDF…</p>,
});

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
  const [pdfFailed, setPdfFailed] = useState(false);

  const item = texts[index];
  const chunk = item?.chunks.find((c) => c.position === chunkPosition);

  useEffect(() => {
    citedRef.current?.scrollIntoView?.({ block: scrollBlock ?? "center" });
  }, [item, chunk, scrollBlock]);

  // The PDF itself lives only in this tab's memory; after a reload only its text is left.
  const pdf = item?.pdf && item.id ? pdfFiles.get(item.id) : undefined;
  const showPdf = pdf !== undefined && !pdfFailed;

  function download() {
    if (!item) return;
    const blob = pdf ?? new Blob([item.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = pdf
      ? pdf.name
      : `${item.title.slice(0, 60).replace(/[^a-zA-Z0-9]/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!item) {
    return (
      <p>
        This text is not in this browser session. Pasted texts are lost when you
        refresh.
      </p>
    );
  }

  return (
    <div className={styles.reader}>
      <header className={styles.card}>
        <h1>{item.title}</h1>
        <p>Your pasted text, kept only in this browser.</p>
        {item.pdf && !pdf && (
          <p>
            The PDF is no longer open in this tab, so the text is shown instead.
          </p>
        )}
        <div className={styles.buttons}>
          <button type="button" className={styles.button} onClick={download}>
            Download
          </button>
        </div>
      </header>
      {showPdf ? (
        <PdfView
          file={pdf}
          page={chunk?.page ?? null}
          citedText={chunk?.text ?? null}
          onError={() => setPdfFailed(true)}
        />
      ) : (
        item.chunks.map((c, index) => {
          const isCited = c === chunk;
          return (
            <div
              key={c.position}
              ref={isCited ? citedRef : undefined}
              aria-current={isCited || undefined}
              className={
                isCited ? `${styles.chunk} ${styles.cited}` : styles.chunk
              }
            >
              {isCited && <span className={styles.tag}>Cited</span>}
              <div className={styles.body}>
                <Markdown>
                  {newText(item.chunks[index - 1]?.text, c.text)}
                </Markdown>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
