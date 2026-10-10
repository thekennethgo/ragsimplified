"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { backendUrl } from "../lib/backend";
import { useMapPoints, type MapOverlay } from "../lib/map";
import { usePrivateTexts } from "../lib/PrivateTexts";
import type { ViewTarget } from "../lib/viewer";
import VectorMap from "./map/VectorMap";
import DocViewer from "./viewer/DocViewer";
import styles from "./LibraryPanel.module.css";

type LibraryDocument = { id: number; title: string; chunk_count: number };
type View = "docs" | "map" | "viewer";

const cards = (n: number) => `${n} ${n === 1 ? "card" : "cards"}`;

/**
 * The File cabinet: the visitor's own books (this tab only) and the starter collection from
 * GET /library. The Vector map tab draws GET /map (fetched the first time it opens), with the
 * question and the Scout's candidates from `overlay` on top. With `onOpen` (the Ask page) it also
 * has a Viewer tab that reads the passage in `viewer` in full.
 */
export default function LibraryPanel({
  onCount,
  onOpen,
  viewer,
  overlay,
}: {
  onCount?: (starterBooks: number) => void;
  onOpen?: (target: ViewTarget) => void;
  viewer?: ViewTarget | null;
  overlay?: MapOverlay;
}) {
  const { texts, remove } = usePrivateTexts();
  const [view, setView] = useState<View>("map");
  const [library, setLibrary] = useState<LibraryDocument[] | null>(null);
  const { points: mapPoints, error: mapError } = useMapPoints(view === "map");

  useEffect(() => {
    fetch(`${backendUrl()}/library`)
      .then((response) => (response.ok ? response.json() : []))
      .then((docs: LibraryDocument[]) => {
        setLibrary(docs);
        onCount?.(docs.length);
      })
      .catch(() => setLibrary([]));
  }, []);

  useEffect(() => {
    if (viewer) setView("viewer");
  }, [viewer]);

  const starter = [...(library ?? [])].sort((a, b) => a.title.localeCompare(b.title));
  const summary =
    library === null ? "Loading…" : `${library.length} starter books, ${texts.length} of yours`;

  return (
    <section id="library" aria-labelledby="lib-h" className="panel">
      <div className={styles.head}>
        <span className={styles.icon}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F2F1EC"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 4h4v16H5zM10 4h4v16h-4z" />
            <path d="M15.5 5l3.8-1 2.7 15.5-3.8 1z" />
          </svg>
        </span>
        <div className={styles.title}>
          <h2 id="lib-h">File cabinet</h2>
          <span>{summary}</span>
        </div>
        <div role="group" aria-label="File cabinet view" className={styles.toggle}>
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>
            Vector map
          </button>
          <button type="button" aria-pressed={view === "docs"} onClick={() => setView("docs")}>
            Documents
          </button>
          {onOpen && (
            <button
              type="button"
              aria-pressed={view === "viewer"}
              disabled={!viewer}
              onClick={() => setView("viewer")}
            >
              Viewer
            </button>
          )}
        </div>
      </div>

      {view === "docs" && (
        <div className={styles.docs}>
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <h3>Your books</h3>
              <span className={styles.tag}>Private · this tab only</span>
            </div>
            {texts.length === 0 ? (
              <p className={styles.empty}>
                Nothing of yours yet. Send a text and it shows up here.
              </p>
            ) : (
              <ul className={styles.books}>
                {texts.map((item, index) => (
                  <li key={index}>
                    <span className={styles.spine} />
                    <div className={styles.bookText}>
                      {onOpen ? (
                        <button
                          type="button"
                          className={styles.open}
                          onClick={() => onOpen({ kind: "private", index, chunk: null })}
                        >
                          {item.title}
                        </button>
                      ) : (
                        <Link href={`/texts/${index}`}>{item.title}</Link>
                      )}
                      <span className={styles.mono}>
                        {cards(item.chunks.length)} · {item.text.length.toLocaleString("en-US")}{" "}
                        characters
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${item.title}`}
                      onClick={() => remove(index)}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                      </svg>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.group}>
            <div className={styles.groupHead}>
              <h3>Starter collection</h3>
              <span className={styles.tag}>Picked by the owner · read-only</span>
            </div>
            {library === null ? (
              <p className={styles.empty}>Loading…</p>
            ) : starter.length === 0 ? (
              <p className={styles.empty}>No documents yet.</p>
            ) : (
              <ul className={styles.starter}>
                {starter.map((doc) => (
                  <li key={doc.id}>
                    {onOpen ? (
                      <button
                        type="button"
                        className={styles.open}
                        onClick={() => onOpen({ kind: "library", id: doc.id, chunk: null })}
                      >
                        {doc.title}
                      </button>
                    ) : (
                      <Link href={`/library/${doc.id}`}>{doc.title}</Link>
                    )}
                    <span className={styles.mono}>{cards(doc.chunk_count)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {view === "viewer" && viewer && (
        <div className={styles.viewer}>
          <DocViewer target={viewer} />
        </div>
      )}

      {view === "map" && <VectorMap points={mapPoints} error={mapError} overlay={overlay} />}
    </section>
  );
}
