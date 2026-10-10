"use client";

import { useEffect, useState } from "react";

import type { Citation, JudgeResult, ScoutResult, Word } from "../../lib/ask";
import { FOUND_BY_COLOR, keyOf, useMapPoints, type MapOverlay } from "../../lib/map";
import type { Phase } from "../../lib/sceneState";
import type { ViewTarget } from "../../lib/viewer";
import VectorMap from "../map/VectorMap";
import { AnswerBubble } from "./AnswerBubble";
import styles from "./AnswerPanel.module.css";
import { HighlightedWords } from "./QuestionBubble";

type TabId = "translator" | "scout" | "judge" | "answer";

const STEPS = [
  {
    id: "translator",
    name: "Translator",
    title: "turns your question into a fingerprint",
    text: "Your question gets the same kind of 1,024-number fingerprint as the cards, so it can be compared with them by meaning.",
    term: "embedding the question",
  },
  {
    id: "scout",
    name: "Scout",
    title: "finds likely cards",
    text: "Looks two ways at once: cards whose fingerprints are closest to your question, and cards that use the same words. It brings back the best matches.",
    term: "hybrid search over chunks",
  },
  {
    id: "judge",
    name: "Judge",
    title: "keeps only the best",
    text: "Reads each card next to your question and scores how well it really answers it. Weak cards are set aside.",
    term: "reranking",
  },
] as const;

const FILLER = new Set(["a","an","the","is","are","was","were","be","been","of","in","on","at","to","for","and","or","but","with","by","from","as","it","its","this","that","these","those","what","which","who","whom","whose","when","where","why","how","do","does","did","can","could","should","would","will","i","you","he","she","we","they","me","my","your","our","their","about","into","than","then","there","so","if","not","no","any","some"]);

const where = (r: { title: string; heading: string | null; page: number | null }) =>
  [r.title, r.heading, r.page !== null ? `page ${r.page}` : null].filter(Boolean).join(" · ");

/** The Answer panel: the answer with its sources, and one tab per step showing what it really did. */
export default function AnswerPanel({
  states,
  answer,
  citations,
  words,
  scout,
  judge,
  askedQuestion,
  targetFor,
  onOpenInViewer,
  follow,
  overlay,
}: {
  states: Record<string, Phase>;
  answer: string;
  citations: Citation[];
  words: Word[];
  scout: ScoutResult[] | null;
  judge: JudgeResult[] | null;
  askedQuestion: string;
  targetFor: (citation: Citation) => ViewTarget | null;
  onOpenInViewer: (target: ViewTarget) => void;
  /** Jump to each step as its results arrive (off when the animations are off). */
  follow: boolean;
  /** The question and the Scout's candidates, drawn on the Scout tab's map. */
  overlay?: MapOverlay;
}) {
  const [tab, setTab] = useState<TabId>("answer");
  // Once the visitor picks a tab, the panel stops switching on its own until the next run.
  const [touched, setTouched] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const { points, error } = useMapPoints(tab === "scout");
  const phase = (id: string): Phase => states[id] ?? "waiting";
  // Follow the newest step whose results are in, and show the answer when it first appears.
  const latest = [...STEPS].reverse().find((s) => phase(s.id) === "done")?.id;
  const fresh = Object.keys(states).length === 0;
  useEffect(() => {
    setTouched(false);
  }, [fresh]);
  useEffect(() => {
    if (touched) return;
    if (follow && latest) setTab(latest);
  }, [follow, latest, touched]);
  const hasAnswer = Boolean(answer);
  useEffect(() => {
    if (touched) return;
    if (hasAnswer) setTab("answer");
  }, [hasAnswer, touched]);
  const step = STEPS.find((s) => s.id === tab);
  const kept = (judge ?? []).filter((r) => r.kept).sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
  const setAside = (judge ?? []).filter((r) => !r.kept);
  const bestByWord = new Map<string, { text: string; influence: number }>();
  for (const w of words) {
    const key = w.text.toLowerCase();
    if (w.influence !== null && w.influence > (bestByWord.get(key)?.influence ?? -1)) {
      bestByWord.set(key, { text: w.text, influence: w.influence });
    }
  }
  const top = [...bestByWord.values()]
    .filter((w) => !FILLER.has(w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")))
    .sort((a, b) => b.influence - a.influence)
    .slice(0, 5);
  const foundBy = (way: ScoutResult["found_by"]) =>
    (scout ?? []).filter((r) => r.found_by === way).length;

  return (
    <div className={`panel ${styles.root}`} role="group" aria-labelledby="ans-h">
      <div className={styles.head}>
        <h2 id="ans-h">Answer</h2>
        <div
          role="group"
          aria-label="Answer and the steps that produced it"
          className={styles.tabs}
        >
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={tab === s.id}
              disabled={phase(s.id) === "waiting"}
              onClick={() => {
                setTouched(true);
                setTab(s.id);
              }}
            >
              <span className={`${styles.dot} ${styles[phase(s.id)]}`} title={phase(s.id)} />
              {s.name}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={tab === "answer"}
            onClick={() => {
              setTouched(true);
              setTab("answer");
            }}
          >
            Answer
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {tab === "answer" && (
          <div className={styles.answerTab}>
            <div className={styles.answerCol}>
              {answer ? (
                <>
                  <p className={styles.asked}>
                    <span>You asked</span>
                    {askedQuestion}
                  </p>
                  <AnswerBubble
                    answer={answer}
                    citations={citations}
                    targetFor={targetFor}
                    onOpenInViewer={onOpenInViewer}
                  />
                </>
              ) : phase("translator") !== "waiting" ? (
                <p className={styles.empty}>Working on it. Open a step above to watch.</p>
              ) : (
                <p className={styles.empty}>Your answer shows up here, with its sources.</p>
              )}
            </div>
            <section aria-labelledby="src-h" className={styles.sources}>
              <h3 id="src-h">Sources</h3>
              {citations.length > 0 ? (
                <ol>
                  {citations.map((c) => {
                    const t = targetFor(c);
                    return (
                      <li key={c.n}>
                        <div className={styles.cardHead}>
                          <span className={styles.num}>{c.n}</span>
                          <span className={styles.name}>{c.title}</span>
                          <span className={styles.mono}>card {c.position + 1}</span>
                        </div>
                        <p className={styles.snippet}>{c.snippet}</p>
                        {t && (
                          <button type="button" onClick={() => onOpenInViewer(t)}>
                            Open in viewer
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className={styles.empty}>{answer ? "Nothing was cited." : "No sources yet."}</p>
              )}
            </section>
          </div>
        )}

        {step && (
          <div className={styles.step}>
            <div className={styles.card}>
              <p className={styles.cardTitle}>
                {step.name} · {step.title}
              </p>
              <p>{step.text}</p>
              <p className={styles.term}>
                In RAG terms: <strong>{step.term}</strong>
              </p>
            </div>

            {phase(tab) !== "done" && (
              <p className={styles.empty}>
                {phase(tab) === "error" ? "This step did not finish." : "Working on it…"}
              </p>
            )}

            {phase(tab) === "done" && tab === "translator" && (
              <div className={styles.block}>
                <h3>
                  Which words mattered <span>· darker = shaped the meaning more</span>
                </h3>
                <div className={styles.translator}>
                  <div className={styles.questionWords}>
                    <HighlightedWords words={words} />
                  </div>
                  {top.length > 0 && (
                    <div className={styles.topBlock}>
                      <h3>
                        Top 5 words <span>· filler words left out</span>
                      </h3>
                      <ol className={styles.topWords}>
                        {top.map((w) => (
                          <li key={w.text.toLowerCase()}>
                            <span className={styles.topWord}>{w.text}</span>
                            <span className={styles.track}>
                              <span className={styles.bar} style={{ width: `${w.influence * 100}%` }} />
                            </span>
                            <span className={styles.mono}>{w.influence.toFixed(2)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}

            {phase(tab) === "done" && tab === "scout" && (
              <div className={styles.block}>
                <div className={styles.chips}>
                  <span className={styles.chipDark}>{scout?.length ?? 0} cards found</span>
                  <span className={styles.chipMeaning}>
                    <i className={styles.chipDot} style={{ background: FOUND_BY_COLOR.vector }} />
                    {foundBy("vector") + foundBy("both")} by meaning
                  </span>
                  <span className={styles.chipWords}>
                    <i className={styles.chipDot} style={{ background: FOUND_BY_COLOR.keyword }} />
                    {foundBy("keyword") + foundBy("both")} by matching words
                  </span>
                  <span className={styles.chipSoft}>
                    <i className={styles.chipDot} style={{ background: FOUND_BY_COLOR.both }} />
                    {foundBy("both")} both
                  </span>
                </div>
                <VectorMap
                  points={points}
                  error={error}
                  overlay={overlay}
                  variant="compact"
                  focus={focus}
                />
                <ol
                  className={styles.scoutRows}
                  style={{ gridTemplateRows: `repeat(${Math.ceil((scout?.length ?? 0) / 2)}, auto)` }}
                >
                  {(scout ?? []).map((r) => (
                    <li
                      key={r.rank}
                      tabIndex={0}
                      onMouseEnter={() => setFocus(keyOf(r))}
                      onFocus={() => setFocus(keyOf(r))}
                      onMouseLeave={() => setFocus(null)}
                      onBlur={() => setFocus(null)}
                    >
                      <span
                        className={styles.num}
                        style={{ background: FOUND_BY_COLOR[r.found_by], color: "#fff" }}
                        title={`Found by ${
                          r.found_by === "vector"
                            ? "meaning"
                            : r.found_by === "keyword"
                              ? "words"
                              : "both"
                        }`}
                      >
                        {r.rank}
                      </span>
                      <span className={styles.name}>{where(r)}</span>
                      <span className={styles.mono}>{r.score.toFixed(3)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {phase(tab) === "done" && tab === "judge" && (
              <div className={styles.judge}>
                <div className={styles.block}>
                  <h3>
                    Kept: the best {kept.length} of {judge?.length ?? 0}
                  </h3>
                  {kept.length === 0 ? (
                    <p className={styles.empty}>
                      None of the cards answered the question, so the Judge kept nothing.
                    </p>
                  ) : (
                    <ol className={styles.rows}>
                      {kept.map((r) => (
                        <li key={r.n}>
                          <span className={styles.num}>{r.n}</span>
                          <span className={styles.name}>{where(r)}</span>
                          <span className={styles.mono}>was #{r.old_rank}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div className={`${styles.block} ${styles.aside}`}>
                  <h3>Set aside: {setAside.length} cards</h3>
                  <ul>
                    {setAside.map((r) => (
                      <li key={`${r.old_rank}`}>{where(r)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
