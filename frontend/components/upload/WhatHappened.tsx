"use client";

import { useEffect, useState } from "react";

import type { Phase } from "../../lib/sceneState";
import styles from "./WhatHappened.module.css";

export type ChunkDetail = {
  position: number;
  heading: string | null;
  length: number;
  overlap: number;
};
type StepId = "chopper" | "translator" | "archivist";

const STEPS: { id: StepId; name: string; title: string; text: string; term: string }[] = [
  {
    id: "chopper",
    name: "Chopper",
    title: "cuts your text into cards",
    text: "Long text is hard to search, so it's cut into cards about a page long. Each card repeats a little of the one before, so no idea gets split in half.",
    term: "chunking",
  },
  {
    id: "translator",
    name: "Translator",
    title: "gives each card a fingerprint",
    text: "Each card becomes a list of 1,024 numbers that captures what it means. Cards about similar things get similar numbers.",
    term: "embedding",
  },
  {
    id: "archivist",
    name: "Archivist",
    title: "files the cards",
    text: "The cards go into the cabinet next to the starter books, ready to be searched. Yours stay in this browser tab only.",
    term: "indexing",
  },
];

const n = (value: number) => value.toLocaleString("en-US");

/** The steps that filed the visitor's text, filled with what the backend really returned. */
export default function WhatHappened({
  states,
  chunks,
  vectors,
}: {
  states: Record<string, Phase>;
  chunks: ChunkDetail[] | null;
  vectors: number[][] | null;
}) {
  const [step, setStep] = useState<StepId>("chopper");
  // Once the visitor picks a tab, the panel stops following the steps until the next run.
  const [touched, setTouched] = useState(false);
  const fresh = Object.keys(states).length === 0;
  useEffect(() => {
    setTouched(false);
  }, [fresh]);
  // Show a step's results as soon as they arrive.
  const latest = [...STEPS].reverse().find((s) => states[s.id] === "done")?.id;
  useEffect(() => {
    if (touched) return;
    if (latest) setStep(latest);
  }, [latest, touched]);
  const current = STEPS.find((s) => s.id === step)!;
  const phase = states[step] ?? "waiting";
  const ready = phase === "done";

  // Where each card starts and ends in the text, from the real lengths and overlaps.
  let start = 0;
  const cards = (chunks ?? []).map((chunk, i) => {
    if (i > 0) start += chunks![i - 1].length - chunk.overlap;
    return { ...chunk, from: start, to: start + chunk.length };
  });
  const total = cards.length ? cards[cards.length - 1].to : 0;

  return (
    <section className={`panel ${styles.panel}`}>
      <details open className={styles.details}>
        <summary className={styles.summary}>
          <h2>What happened</h2>
        </summary>
        <div className={styles.inner}>
          <div role="group" aria-label="The steps that filed your text" className={styles.tabs}>
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={step === s.id}
                disabled={s.id !== "chopper" && (states[s.id] ?? "waiting") === "waiting"}
                onClick={() => {
                  setTouched(true);
                  setStep(s.id);
                }}
              >
                <span
                  className={`${styles.dot} ${styles[states[s.id] ?? "waiting"]}`}
                  title={states[s.id] ?? "waiting"}
                />
                {s.name}
              </button>
            ))}
          </div>
          <div className={styles.body}>
            <div className={styles.card}>
              <p className={styles.cardTitle}>
                {current.name} · {current.title}
              </p>
              <p>{current.text}</p>
              <p className={styles.term}>
                In RAG terms: <strong>{current.term}</strong>
              </p>
            </div>

            {!ready && (
              <p className={styles.empty}>
                {phase === "working"
                  ? "Working on it…"
                  : phase === "error"
                    ? "This step did not finish."
                    : "Send a text to see this step."}
              </p>
            )}

            {ready && step === "chopper" && (
              <div className={styles.list}>
                <h3>
                  {cards.length} cards from {n(total)} characters{" "}
                  <span>· gold = shared with the next card</span>
                </h3>
                <ol>
                  {cards.map((card, i) => {
                    const next = cards[i + 1]?.overlap ?? 0;
                    return (
                      <li key={card.position}>
                        <span className={styles.num}>{i + 1}</span>
                        <span className={styles.name}>
                          {card.heading ?? `Card ${i + 1}`}{" "}
                          <span className={styles.mono}>
                            · {n(card.from + 1)}–{n(card.to)}
                          </span>
                        </span>
                        <div
                          className={styles.range}
                          title={`Characters ${n(card.from + 1)}–${n(card.to)}`}
                        >
                          <div
                            className={styles.span}
                            style={{
                              left: `${(card.from / total) * 100}%`,
                              width: `${(card.length / total) * 100}%`,
                            }}
                          />
                          {next > 0 && (
                            <div
                              className={styles.shared}
                              style={{
                                left: `${((card.to - next) / total) * 100}%`,
                                width: `${(next / total) * 100}%`,
                              }}
                            />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {ready && step === "translator" && (
              <div className={styles.list}>
                <h3>
                  {vectors?.length ?? 0} fingerprints{" "}
                  <span>· the first 32 of 1,024 numbers each</span>
                </h3>
                <ol>
                  {(vectors ?? []).map((vector, i) => (
                    <li key={i}>
                      <span className={styles.num}>{i + 1}</span>
                      <span className={styles.name}>{cards[i]?.heading ?? `Card ${i + 1}`}</span>
                      <div aria-hidden="true" className={styles.print}>
                        {vector.slice(0, 32).map((v, k, first) => {
                          const peak = Math.max(...first.map(Math.abs), 1e-9);
                          const h = Math.max(2, Math.round((Math.abs(v) / peak) * 13));
                          return (
                            <span
                              key={k}
                              style={{
                                height: h,
                                marginTop: v < 0 ? h : 0,
                                marginBottom: v >= 0 ? h : 0,
                                background: v >= 0 ? "#7A5236" : "#C2AE92",
                              }}
                            />
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {ready && step === "archivist" && (
              <div className={styles.card}>
                <p>Filed with your books, in this tab only.</p>
              </div>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
