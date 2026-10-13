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
// Room kept under each page for its "Page N" label.
const LABEL_HEIGHT = 48;
const MIN_MARK_LENGTH = 4;

/** The width at which a whole page fits: the container's width, 720, and its height at this aspect. */
export function pageWidth(
  containerWidth: number,
  containerHeight: number,
  aspect: number | null,
): number {
  const byHeight =
    aspect !== null && containerHeight > LABEL_HEIGHT
      ? (containerHeight - LABEL_HEIGHT) * aspect
      : Infinity;
  return Math.floor(Math.min(containerWidth, MAX_WIDTH, byHeight));
}

/** The nearest ancestor that scrolls vertically, or null when the page itself scrolls. */
function scrollAncestor(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

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
  const [available, setAvailable] = useState(MAX_WIDTH);
  // The height of the viewer (or of the window on the full-page route), and the page's shape.
  const [height, setHeight] = useState(0);
  const [aspect, setAspect] = useState<number | null>(null);
  const width = pageWidth(available, height, aspect);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const cited = citedText === null ? null : normalise(citedText);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width);
      if (next > 0) setAvailable(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const scroller = scrollAncestor(element);
    if (!scroller) {
      const onResize = () => setHeight(window.innerHeight);
      onResize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
    setHeight(scroller.clientHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setHeight(Math.floor(entry.contentRect.height));
    });
    observer.observe(scroller);
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
                onLoadSuccess={
                  number === 1
                    ? (loaded) => setAspect(loaded.originalWidth / loaded.originalHeight)
                    : undefined
                }
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
