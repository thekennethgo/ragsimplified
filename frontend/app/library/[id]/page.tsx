"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { backendUrl } from "../../../lib/backend";

type Chunk = { id: number; position: number; page: number | null; heading: string | null; text: string };
type LibraryDocument = { id: number; title: string; filename: string; chunks: Chunk[] };

export default function LibraryDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const cited = Number(useSearchParams().get("chunk"));
  const hasCited = useSearchParams().get("chunk") !== null;
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
    citedRef.current?.scrollIntoView?.({ block: "center" });
  }, [doc]);

  if (error) return <p>Document not found.</p>;
  if (!doc) return <p>Loading…</p>;

  const citedChunk = hasCited ? doc.chunks.find((chunk) => chunk.position === cited) : undefined;
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
      {doc.chunks.map((chunk) => {
        const isCited = chunk === citedChunk;
        return (
          <section
            key={chunk.id}
            ref={isCited ? citedRef : undefined}
            aria-current={isCited}
            style={isCited ? { background: "#fff3bf" } : undefined}
          >
            {chunk.heading && <h2>{chunk.heading}</h2>}
            <pre style={{ whiteSpace: "pre-wrap" }}>{chunk.text}</pre>
            {chunk.page !== null && <small>Page {chunk.page}</small>}
          </section>
        );
      })}
    </>
  );
}
