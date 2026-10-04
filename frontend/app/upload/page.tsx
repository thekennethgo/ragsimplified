"use client";

import { type FormEvent, useEffect, useState } from "react";

import { MAX_TEXT_CHARS, backendUrl, readEvents } from "../../lib/backend";
import { type PrivateText, usePrivateTexts } from "../../lib/PrivateTexts";

type LibraryDocument = { id: number; title: string; chunk_count: number };

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState<LibraryDocument[] | null>(null);
  // Private texts live only in the browser's memory (ADR 002): nothing is stored server-side.
  const { texts: yourTexts, add } = usePrivateTexts();

  useEffect(() => {
    fetch(`${backendUrl()}/library`)
      .then((response) => (response.ok ? response.json() : []))
      .then(setLibrary)
      .catch(() => setLibrary([]));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLog([]);
    try {
      const response = await fetch(`${backendUrl()}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text }),
      });
      if (!response.ok) {
        setLog([`Upload rejected (${response.status})`]);
        return;
      }
      for await (const e of readEvents(response)) {
        if (!("status" in e)) continue;
        setLog((lines) => [...lines, `${e.step}: ${e.status}`]);
        if (e.step === "error") {
          setLog((lines) => [...lines, String(e.data?.message ?? "Upload failed")]);
        } else if (e.step === "translator" && e.status === "done" && e.data) {
          const { chunks, vectors } = e.data as Pick<PrivateText, "chunks" | "vectors">;
          add({ title, text, chunks, vectors });
          setTitle("");
          setText("");
        }
      }
    } catch {
      setLog((lines) => [...lines, "Could not reach the backend"]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Upload</h1>
      <p>
        Paste text to ask questions about it. It is sent to Voyage (to embed it) and to Anthropic
        (when it is used to answer). It is not stored on the server; this browser keeps it until
        you close or refresh the tab.
      </p>

      <form onSubmit={onSubmit}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </label>
        <label>
          Text
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_TEXT_CHARS}
            rows={10}
          />
        </label>
        <p aria-live="polite">
          {text.length} / {MAX_TEXT_CHARS}
        </p>
        <button type="submit" disabled={busy || !title.trim() || !text.trim()}>
          {busy ? "Working…" : "Add text"}
        </button>
      </form>

      <section aria-label="Progress">
        <h2>Progress</h2>
        <pre>{log.join("\n")}</pre>
      </section>

      <section aria-label="Your texts">
        <h2>Your texts</h2>
        {yourTexts.length === 0 ? (
          <p>Nothing yet.</p>
        ) : (
          <ul>
            {yourTexts.map((item, index) => (
              <li key={index}>
                {item.title} ({item.chunks.length} chunks)
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Starter library">
        <h2>Starter library</h2>
        {library === null ? (
          <p>Loading…</p>
        ) : library.length === 0 ? (
          <p>No documents yet.</p>
        ) : (
          <ul>
            {library.map((doc) => (
              <li key={doc.id}>
                {doc.title} ({doc.chunk_count} chunks)
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
