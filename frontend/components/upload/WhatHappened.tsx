"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

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
  envelope,
  run = 0,
}: {
  states: Record<string, Phase>;
  chunks: ChunkDetail[] | null;
  vectors: number[][] | null;
  /** The upload form, shown in the first tab ("Your document"). */
  envelope: ReactNode;
  /** Changes with every new upload, which hands the panel back to the steps. */
  run?: number;
}) {
  const [step, setStep] = useState<StepId | "doc">("doc");
  // Once the visitor picks a tab, the panel stops following the steps until the next upload.
  // A ref, set inside the click, so an effect left over from an earlier render cannot undo the pick.
  const touched = useRef(false);
  const prevRun = useRef(run);
  useEffect(() => {
    touched.current = false;
    // Sending moves the panel from the form to the steps.
    if (run !== prevRun.current) {
      prevRun.current = run;
      setStep("chopper");
    }
  }, [run]);
  // Show a step's results as soon as they arrive.
  const latest = [...STEPS].reverse().find((s) => states[s.id] === "done")?.id;
  useEffect(() => {
    if (touched.current) return;
    if (latest) setStep(latest);
  }, [latest]);
  const about = useAbout();
  const current: StepId = step === "doc" ? "chopper" : step;
  const copy = {
    chopper: chopperCopy(about),
    translator: uploadTranslatorCopy(about),
    archivist: archivistCopy(),
  }[current];
  const phase = states[current] ?? "waiting";
  const ready = phase === "done";

  // Where each card starts and ends in the text, from the real lengths and overlaps.
  let start = 0;
  const cards = (chunks ?? []).map((chunk, i) => {
    if (i > 0) start += chunks![i - 1].length - chunk.overlap;
    return { ...chunk, from: start, to: start + chunk.length };
  });
  const total = cards.length ? cards[cards.length - 1].to : 0;

  return (
    <section className={styles.root} aria-labelledby="team-h">
      <div className={styles.head}>
        <h2 id="team-h" className="visually-hidden">
          Meet the team
        </h2>
        <div role="group" aria-label="The characters that filed your text" className={styles.tabs}>
          <button
            type="button"
            aria-pressed={step === "doc"}
            onClick={() => {
              touched.current = true;
              setStep("doc");
            }}
          >
            Your document
          </button>
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={step === s.id}
              style={{ "--c": `var(--${s.id})` } as CSSProperties}
              onClick={() => {
                touched.current = true;
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
      </div>
          <div className={styles.body}>
            {/* Kept mounted so a half-typed text survives a trip to the other tabs. */}
            <div hidden={step !== "doc"} className={styles.envelope}>
              {envelope}
            </div>
            {step !== "doc" && (
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
            )}
          </div>
    </section>
  );
}
