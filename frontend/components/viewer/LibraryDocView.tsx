"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { backendUrl } from "../../lib/backend";
import { newText } from "../../lib/overlap";
import { loadSources, type Source } from "../../lib/sources";
import styles from "./DocViewer.module.css";
import Markdown from "./Markdown";

const PdfView = dynamic(() => import("./PdfView"), {
  ssr: false,
  loading: () => <p>Loading the PDF…</p>,
});

type Chunk = { id: number; position: number; page: number | null; heading: string | null; text: string };
type LibraryDocument = { id: number; title: string; filename: string; chunks: Chunk[] };

/** A starter-library document in full, with the cited chunk highlighted and scrolled into view. */
export default function LibraryDocView({
  id,
  chunk,
  scrollBlock,
}: {
  id: number;
  chunk: number | null;
  scrollBlock?: ScrollLogicalPosition;
}) {
  const [doc, setDoc] = useState<LibraryDocument | null>(null);
  const [error, setError] = useState(false);
  const [sources, setSources] = useState<Record<string, Source>>({});
  const [pdfFailed, setPdfFailed] = useState(false);
  const citedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch(`${backendUrl()}/library/${id}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then(setDoc)
      .catch(() => setError(true));
  }, [id]);

  useEffect(() => {
    let live = true;
    loadSources().then((all) => live && setSources(all));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    citedRef.current?.scrollIntoView?.({ block: scrollBlock ?? "center" });
  }, [doc, scrollBlock]);

  if (error) return <p>Document not found.</p>;
  if (!doc) return <p>Loading…</p>;

  const citedChunk = chunk === null ? undefined : doc.chunks.find((c) => c.position === chunk);
  const isPdf = doc.filename.toLowerCase().endsWith(".pdf");
  const originalHref =
    `/corpus/${doc.filename}` + (isPdf && citedChunk?.page ? `#page=${citedChunk.page}` : "");

  const entry = sources[doc.filename];

  const showPdf = isPdf && !pdfFailed;
  // One continuous document: each chunk's new text only, without the overlap or the title line.
  const parts = doc.chunks.map((c, index) => {
    let text = newText(doc.chunks[index - 1]?.text, c.text);
    if (index === 0) text = text.replace(/^# .*(\r?\n|$)/, "").trimStart();
    return { chunk: c, text };
  });

  return (
    <div className={styles.reader}>
      <header className={styles.card}>
        <h1>{doc.title}</h1>
        {entry && (
          <p>
            <small>
              Source: {entry.url ? <a href={entry.url}>{entry.source}</a> : entry.source} ·{" "}
              {entry.licence}
              {entry.note ? ` · ${entry.note}` : ""}
            </small>
          </p>
        )}
        <div className={styles.buttons}>
          <a className={styles.button} href={originalHref}>
            Open the original{isPdf && citedChunk?.page ? ` at page ${citedChunk.page}` : ""}
          </a>
          <a className={styles.button} href={`/corpus/${doc.filename}`} download>
            Download
          </a>
        </div>
      </header>
      {showPdf ? (
        <PdfView
          filename={doc.filename}
          page={citedChunk?.page ?? null}
          citedText={citedChunk?.text ?? null}
          onError={() => setPdfFailed(true)}
        />
      ) : (
        parts.map(({ chunk: c, text }) => {
          const isCited = c === citedChunk;
          return (
            <div
              key={c.id}
              ref={isCited ? citedRef : undefined}
              aria-current={isCited || undefined}
              className={isCited ? `${styles.chunk} ${styles.cited}` : styles.chunk}
            >
              {isCited && <span className={styles.tag}>Cited</span>}
              <div className={styles.body}>
                <Markdown>{text}</Markdown>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
