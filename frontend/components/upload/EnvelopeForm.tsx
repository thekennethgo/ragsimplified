"use client";

import { type DragEvent, type FormEvent, useState } from "react";

import { MAX_TEXT_CHARS } from "../../lib/backend";
import styles from "./EnvelopeForm.module.css";

const ACCEPTED = /\.(md|txt)$/i;

/** The interoffice envelope: a title, lined paper and a file picker. Nothing is stored (ADR 002). */
export default function EnvelopeForm({
  onSubmit,
  busy,
}: {
  /** Resolves true when the text was added, so the form can empty itself. */
  onSubmit: (title: string, text: string) => Promise<boolean | void>;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [fileError, setFileError] = useState("");

  function readFile(file: File) {
    setNote("");
    if (!ACCEPTED.test(file.name)) {
      setFileError("Only .md and .txt files");
      return;
    }
    setFileError("");
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setTitle(file.name.replace(ACCEPTED, "").slice(0, 200));
      setText(content.slice(0, MAX_TEXT_CHARS));
      if (content.length > MAX_TEXT_CHARS) {
        setNote(`Cut to the first ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters.`);
      }
    };
    reader.readAsText(file);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) readFile(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await onSubmit(title, text)) {
      setTitle("");
      setText("");
      setNote("");
    }
  }

  const percent = Math.min(100, (text.length / MAX_TEXT_CHARS) * 100);

  return (
    <section aria-labelledby="env-h" className={styles.envelope}>
      <svg
        viewBox="0 0 400 56"
        preserveAspectRatio="none"
        width="100%"
        height="56"
        aria-hidden="true"
        className={styles.flap}
      >
        <path d="M0 0H400V22L200 54L0 22Z" fill="#D8C08E" />
      </svg>
      <div className={styles.seal} />
      <form className={styles.body} onSubmit={submit}>
        <div className={styles.heading}>
          <span className={styles.kicker}>Interoffice mail · To: File cabinet</span>
          <h2 id="env-h">Add a text</h2>
        </div>
        <label className={styles.field}>
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="e.g. Team handbook, chapter 2"
          />
        </label>
        <label className={styles.field}>
          Text
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_TEXT_CHARS}
            rows={9}
            placeholder="Paste up to 20,000 characters"
          />
        </label>
        <div className={styles.count}>
          <div className={styles.bar}>
            <div style={{ width: `${percent}%` }} />
          </div>
          <p aria-live="polite">
            {text.length.toLocaleString("en-US")} / {MAX_TEXT_CHARS.toLocaleString("en-US")}
          </p>
        </div>
        <label className={styles.drop} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <input
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
            className="visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFile(file);
              e.target.value = "";
            }}
          />
          Pick or drop a file <span>(.md or .txt)</span>
        </label>
        {note && <p className={styles.note}>{note}</p>}
        {fileError && (
          <p role="alert" className={styles.error}>
            {fileError}
          </p>
        )}
        <button
          type="submit"
          aria-label="Add text"
          className={styles.send}
          disabled={busy || !title.trim() || !text.trim()}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4z" />
          </svg>
          {busy ? "Sending…" : "Send to file cabinet"}
        </button>
        <div className={styles.privacy}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <p>
            Sent to Voyage AI (fingerprints) and Anthropic (answers). Never stored on our server: it
            stays in this tab until you close it.
          </p>
        </div>
      </form>
    </section>
  );
}
