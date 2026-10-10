"use client";

import { useEffect, useState } from "react";

import { useAbout } from "../../lib/about";
import {
  archivistCopy,
  chopperCopy,
  NOTHING_YET_UPLOAD,
  uploadTranslatorCopy,
} from "../../lib/characters";
import type { Phase } from "../../lib/sceneState";
import CharacterCard from "../characters/CharacterCard";
import styles from "./WhatHappened.module.css";

export type ChunkDetail = {
  position: number;
  heading: string | null;
  length: number;
  overlap: number;
};
type StepId = "chopper" | "translator" | "archivist";

const STEPS: { id: StepId; name: string; part: string }[] = [
  { id: "chopper", name: "Chopper", part: "ch" },
  { id: "translator", name: "Translator", part: "tr" },
  { id: "archivist", name: "Archivist", part: "ar" },
];

const n = (value: number) => value.toLocaleString("en-US");

/** One tab per character that filed the visitor's text, filled with what the backend really returned. */
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
  const about = useAbout();
  const copy = {
    chopper: chopperCopy(about),
    translator: uploadTranslatorCopy(about),
    archivist: archivistCopy(),
  }[step];
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
          <h2>Meet the team</h2>
        </summary>
        <div className={styles.inner}>
          <div role="group" aria-label="The characters that filed your text" className={styles.tabs}>
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={step === s.id}
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
            <CharacterCard
              name={STEPS.find((s) => s.id === step)!.name}
              room="/office/upload-room.svg"
              part={STEPS.find((s) => s.id === step)!.part}
              role={copy.role}
              phase={phase}
              plain={copy.plain}
              tech={copy.tech}
              how={copy.how}
              settings={copy.settings}
              thisRun={
                <>
                  {!ready && (
                    <p className={styles.empty}>
                      {phase === "working"
                        ? "Working on it…"
                        : phase === "error"
                          ? "This step did not finish."
                          : NOTHING_YET_UPLOAD}
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

                    {ready && step === "archivist" && <p>Filed in your folder. Only this tab can see it.</p>}
                </>
              }
            />
          </div>
        </div>
      </details>
    </section>
  );
}
