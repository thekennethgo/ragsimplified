"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";

import styles from "./DocViewer.module.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MAX_WIDTH = 720;
const MIN_MARK_LENGTH = 4;

function normalise(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Every page of a library PDF in one column, with the cited chunk's text marked on its page. */
export default function PdfView({
  filename,
  page,
  citedText,
  onError,
}: {
  filename: string;
  page: number | null;
  citedText: string | null;
  onError: () => void;
}) {
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(MAX_WIDTH);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const cited = citedText === null ? null : normalise(citedText);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const available = Math.floor(entry.contentRect.width);
      if (available > 0) setWidth(Math.min(MAX_WIDTH, available));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function scrollToCited() {
    const wrapper = page === null ? null : pageRefs.current[page];
    if (!wrapper) return;
    (wrapper.querySelector("mark") ?? wrapper).scrollIntoView?.({ block: "center" });
  }

  return (
    <div ref={containerRef} className={styles.pdf}>
      <Document
        file={`/corpus/${filename}`}
        onLoadSuccess={({ numPages: count }) => setNumPages(count)}
        onLoadError={onError}
        loading={<p>Loading the PDF…</p>}
        error={null}
      >
        {Array.from({ length: numPages }, (_, index) => {
          const number = index + 1;
          const isCited = number === page && cited !== null;
          return (
            <div
              key={number}
              className={styles.pdfPage}
              ref={(element) => {
                pageRefs.current[number] = element;
              }}
            >
              <p className={styles.pageLabel}>Page {number}</p>
              <Page
                pageNumber={number}
                width={width}
                renderTextLayer
                renderAnnotationLayer={false}
                customTextRenderer={
                  isCited
                    ? ({ str }) => {
                        const piece = normalise(str);
                        return piece.length >= MIN_MARK_LENGTH && cited.includes(piece)
                          ? `<mark>${escapeHtml(str)}</mark>`
                          : escapeHtml(str);
                      }
                    : undefined
                }
                onRenderTextLayerSuccess={number === page ? scrollToCited : undefined}
              />
            </div>
          );
        })}
      </Document>
    </div>
  );
}
