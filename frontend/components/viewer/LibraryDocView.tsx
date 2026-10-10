"use client";

import { useEffect, useRef, useState } from "react";

import { backendUrl } from "../../lib/backend";

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
  const citedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fetch(`${backendUrl()}/library/${id}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then(setDoc)
      .catch(() => setError(true));
  }, [id]);

  useEffect(() => {
    citedRef.current?.scrollIntoView?.({ block: scrollBlock ?? "center" });
  }, [doc, scrollBlock]);

  if (error) return <p>Document not found.</p>;
  if (!doc) return <p>Loading…</p>;

  const citedChunk = chunk === null ? undefined : doc.chunks.find((c) => c.position === chunk);
  const isPdf = doc.filename.toLowerCase().endsWith(".pdf");
  const originalHref =
    `/corpus/${doc.filename}` + (isPdf && citedChunk?.page ? `#page=${citedChunk.page}` : "");

  return (
    <>
      <h1>{doc.title}</h1>
      <p>
        <a href={originalHref}>
          Open the original{isPdf && citedChunk?.page ? ` at page ${citedChunk.page}` : ""}
        </a>
      </p>
      {doc.chunks.map((c) => {
        const isCited = c === citedChunk;
        return (
          <section
            key={c.id}
            ref={isCited ? citedRef : undefined}
            aria-current={isCited}
            style={isCited ? { background: "#fff3bf" } : undefined}
          >
            {c.heading && <h2>{c.heading}</h2>}
            <pre style={{ whiteSpace: "pre-wrap" }}>{c.text}</pre>
            {c.page !== null && <small>Page {c.page}</small>}
          </section>
        );
      })}
    </>
  );
}
