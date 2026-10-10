"use client";

import { useEffect, useRef } from "react";

import { usePrivateTexts } from "../../lib/PrivateTexts";
import { locatePassage } from "../../lib/passage";

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
  const markRef = useRef<HTMLElement | null>(null);

  const item = texts[index];
  const chunk = item?.chunks.find((c) => c.position === chunkPosition);
  const range = item && chunk ? locatePassage(item.text, chunk.text) : null;

  useEffect(() => {
    markRef.current?.scrollIntoView?.({ block: scrollBlock ?? "center" });
  }, [item, range?.[0], scrollBlock]);

  if (!item) {
    return <p>This text is not in this browser session. Pasted texts are lost when you refresh.</p>;
  }

  return (
    <>
      <h1>{item.title}</h1>
      <p>Your pasted text, kept only in this browser.</p>
      {range ? (
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {item.text.slice(0, range[0])}
          <mark ref={markRef} aria-current="true">
            {item.text.slice(range[0], range[1])}
          </mark>
          {item.text.slice(range[1])}
        </pre>
      ) : (
        <>
          <pre style={{ whiteSpace: "pre-wrap" }}>{item.text}</pre>
          {chunk && (
            <>
              <h2>Cited passage</h2>
              <blockquote>
                <mark aria-current="true">{chunk.text}</mark>
              </blockquote>
            </>
          )}
        </>
      )}
    </>
  );
}
