"use client";

import { type FormEvent, Fragment, useRef, useState } from "react";

import { backendUrl, readEvents } from "../../lib/backend";
import { usePrivateTexts } from "../../lib/PrivateTexts";

const MAX_QUESTION_CHARS = 1_000;
// The backend accepts at most this many private chunks per question.
const MAX_PRIVATE_CHUNKS = 60;

type Citation = {
  n: number;
  source: "library" | "private";
  title: string;
  page: number | null;
  heading: string | null;
  snippet: string;
};

/** Split an answer into text and [n] markers; a marker is a button only if it has a source. */
function AnswerText({
  answer,
  citations,
  onOpen,
}: {
  answer: string;
  citations: Citation[];
  onOpen: (n: number) => void;
}) {
  const known = new Set(citations.map((c) => c.n));
  return (
    <p>
      {answer.split(/(\[\d+\])/).map((part, index) => {
        const match = /^\[(\d+)\]$/.exec(part);
        if (!match || !known.has(Number(match[1]))) {
          return <Fragment key={index}>{part}</Fragment>;
        }
        const n = Number(match[1]);
        return (
          <button key={index} type="button" aria-label={`Source ${n}`} onClick={() => onOpen(n)}>
            [{n}]
          </button>
        );
      })}
    </p>
  );
}

export default function AskPage() {
  const { texts } = usePrivateTexts();
  const [question, setQuestion] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const sourceRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  const privateChunks = texts
    .flatMap((item) =>
      item.chunks.map((chunk, i) => ({
        title: item.title,
        position: chunk.position,
        heading: chunk.heading,
        text: chunk.text,
        vector: item.vectors[i],
      })),
    )
    .slice(0, MAX_PRIVATE_CHUNKS);
  const totalPrivateChunks = texts.reduce((sum, item) => sum + item.chunks.length, 0);

  function openSource(n: number) {
    setSelected(n);
    sourceRefs.current.get(n)?.scrollIntoView?.({ block: "nearest" });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLog([]);
    setAnswer("");
    setCitations([]);
    setSelected(null);
    try {
      const response = await fetch(`${backendUrl()}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, private_chunks: privateChunks }),
      });
      if (!response.ok) {
        setLog([`Question rejected (${response.status})`]);
        return;
      }
      for await (const e of readEvents(response)) {
        if ("delta" in e) {
          setAnswer((text) => text + e.delta);
          continue;
        }
        setLog((lines) => [...lines, `${e.step}: ${e.status}`]);
        if (e.step === "error") {
          setLog((lines) => [...lines, String(e.data?.message ?? "Something went wrong")]);
        } else if (e.step === "storyteller" && e.status === "done" && e.data) {
          // The final answer has made-up [n] markers removed.
          setAnswer(String(e.data.answer ?? ""));
          setCitations((e.data.citations ?? []) as Citation[]);
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
      <h1>Ask</h1>
      <p>
        Questions search the starter library
        {texts.length > 0 ? ` and your ${texts.length} pasted text(s)` : ""}. Your question and the
        passages found are sent to Voyage and to the language model provider.
      </p>
      {totalPrivateChunks > MAX_PRIVATE_CHUNKS && (
        <p>
          Only the first {MAX_PRIVATE_CHUNKS} of your {totalPrivateChunks} chunks are searched.
        </p>
      )}

      <form onSubmit={onSubmit}>
        <label>
          Question
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={MAX_QUESTION_CHARS}
            rows={3}
          />
        </label>
        <p aria-live="polite">
          {question.length} / {MAX_QUESTION_CHARS}
        </p>
        <button type="submit" disabled={busy || !question.trim()}>
          {busy ? "Working…" : "Ask"}
        </button>
      </form>

      <section aria-label="Progress">
        <h2>Progress</h2>
        <pre>{log.join("\n")}</pre>
      </section>

      <section aria-label="Answer">
        <h2>Answer</h2>
        <AnswerText answer={answer} citations={citations} onOpen={openSource} />
      </section>

      <section aria-label="Sources">
        <h2>Sources</h2>
        {citations.length === 0 ? (
          <p>No sources cited.</p>
        ) : (
          <ul>
            {citations.map((c) => (
              <li
                key={c.n}
                ref={(node) => {
                  if (node) sourceRefs.current.set(c.n, node);
                }}
                aria-current={selected === c.n}
                style={selected === c.n ? { background: "#fff3bf" } : undefined}
              >
                <strong>[{c.n}]</strong> {c.title}
                {c.page !== null ? `, page ${c.page}` : ""}
                {c.heading ? ` (${c.heading})` : ""}{" "}
                <em>{c.source === "private" ? "your pasted text" : "starter library"}</em>
                <blockquote>{c.snippet}</blockquote>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
