"use client";

import { useEffect, useRef, useState } from "react";

import { useAbout } from "../../lib/about";
import type {
  Citation,
  JudgeResult,
  JudgeRound2,
  Look,
  ScoutResult,
  ScoutRound2,
  TranslatorRound2,
  Word,
} from "../../lib/ask";
import {
  askTranslatorCopy,
  clerkCopy,
  judgeCopy,
  NOTHING_YET_ASK,
  scoutCopy,
  storytellerCopy,
} from "../../lib/characters";
import { FOUND_BY_COLOR, keyOf, useMapPoints, type MapOverlay, type MapPoint } from "../../lib/map";
import type { Phase } from "../../lib/sceneState";
import type { ViewTarget } from "../../lib/viewer";
import CharacterCard from "../characters/CharacterCard";
import VectorMap from "../map/VectorMap";
import { AnswerBubble } from "./AnswerBubble";
import styles from "./AnswerPanel.module.css";
import { HighlightedWords } from "./QuestionBubble";

type TabId = "clerk" | "translator" | "scout" | "judge" | "storyteller" | "answer";

const STEPS = [
  { id: "clerk", name: "Clerk", part: "cl" },
  { id: "translator", name: "Translator", part: "tr" },
  { id: "scout", name: "Scout", part: "sc" },
  { id: "judge", name: "Judge", part: "jd" },
  { id: "storyteller", name: "Storyteller", part: "st" },
] as const;

/** The steps that report their own phase; the Clerk's is worked out from them. */
const FOLLOWED = ["translator", "scout", "judge", "storyteller"] as const;

const FILLER = new Set(["a","an","the","is","are","was","were","be","been","of","in","on","at","to","for","and","or","but","with","by","from","as","it","its","this","that","these","those","what","which","who","whom","whose","when","where","why","how","do","does","did","can","could","should","would","will","i","you","he","she","we","they","me","my","your","our","their","about","into","than","then","there","so","if","not","no","any","some"]);

const where = (r: { title: string; heading: string | null; page: number | null }) =>
  [r.title, r.heading, r.page !== null ? `page ${r.page}` : null].filter(Boolean).join(" · ");

/** The tabs that get a second page when a second look happens. */
const ROUND_TABS = ["clerk", "translator", "scout", "judge"] as const;
type RoundTab = (typeof ROUND_TABS)[number];

/** Who decided whether the sources were enough, in one line. */
function decidedLine(look: Look): string {
  const pct = look.enough === null ? null : `${Math.round(look.enough * 100)}%`;
  if (pct === null) return "The language model decided.";
  if (look.decidedBy === "decider") {
    return `Mercury Decide judged the sources enough (${pct} sure they were).`;
  }
  return look.query
    ? `Mercury Decide judged the sources not enough (${pct} sure they were).`
    : `Mercury Decide was only ${pct} sure, so the language model decided the sources were enough.`;
}

function RoundSwitch({ round, onChange }: { round: 1 | 2; onChange: (round: 1 | 2) => void }) {
  return (
    <div role="group" aria-label="Round" className={styles.roundSwitch}>
      <button type="button" aria-pressed={round === 1} onClick={() => onChange(1)}>
        Initial
      </button>
      <button type="button" aria-pressed={round === 2} onClick={() => onChange(2)}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="7.6" y1="7.6" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Second look
      </button>
    </div>
  );
}

/** One Scout page: the chips, the compact map and the numbered list (round 1 or round 2). */
function ScoutPage({
  results,
  overlay,
  points,
  error,
  skipped = 0,
}: {
  results: ScoutResult[];
  overlay: MapOverlay;
  points: MapPoint[] | null;
  error: boolean;
  /** Round 2 only: how many cards were dropped because round 1 already had them. */
  skipped?: number;
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const foundBy = (way: ScoutResult["found_by"]) => results.filter((r) => r.found_by === way).length;
  return (
    <div className={styles.block}>
      <div className={styles.chips}>
        <span className={styles.chipDark}>{results.length} cards found</span>
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
        {skipped > 0 && <span className={styles.chipSkipped}>{skipped} already found, skipped</span>}
      </div>
      <VectorMap points={points} error={error} overlay={overlay} variant="compact" focus={focus} />
      <ol
        className={styles.scoutRows}
        style={{ gridTemplateRows: `repeat(${Math.ceil(results.length / 2)}, auto)` }}
      >
        {results.map((r) => (
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
                r.found_by === "vector" ? "meaning" : r.found_by === "keyword" ? "words" : "both"
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
  );
}

/** The Judge's verdict on a list of candidates: the kept rows and the cards set aside. */
function JudgeVerdict({ results, title, none }: { results: JudgeResult[]; title: string; none: string }) {
  const kept = results.filter((r) => r.kept).sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
  const setAside = results.filter((r) => !r.kept);
  return (
    <div className={styles.judge}>
      <div className={styles.block}>
        <h3>{title}</h3>
        {kept.length === 0 ? (
          <p className={styles.empty}>{none}</p>
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
  );
}

/** The Answer panel: the answer with its sources, and one tab per step showing what it really did. */
export default function AnswerPanel({
  states,
  answer,
  citations,
  words,
  scout,
  look = null,
  translator2 = null,
  scout2 = null,
  judge2 = null,
  round2 = {},
  judge,
  askedQuestion,
  targetFor,
  onOpenInViewer,
  follow,
  overlay,
  privateSent,
  sentPrompt,
}: {
  states: Record<string, Phase>;
  answer: string;
  citations: Citation[];
  words: Word[];
  scout: ScoutResult[] | null;
  /** The second look: the check's outcome, each character's round 2 page, and its progress. */
  look?: Look | null;
  translator2?: TranslatorRound2 | null;
  scout2?: ScoutRound2 | null;
  judge2?: JudgeRound2 | null;
  round2?: Record<string, Phase>;
  judge: JudgeResult[] | null;
  askedQuestion: string;
  targetFor: (citation: Citation) => ViewTarget | null;
  onOpenInViewer: (target: ViewTarget) => void;
  /** Jump to each step as its results arrive (off when the animations are off). */
  follow: boolean;
  /** The question and the Scout's candidates, drawn on the Scout tab's map. */
  overlay?: MapOverlay;
  /** How many of the visitor's own cards went along with the question. */
  privateSent: number;
  /** The exact message the Storyteller's model was sent, once the backend has said. */
  sentPrompt: string | null;
}) {
  const [tab, setTab] = useState<TabId>("answer");
  // Once the visitor picks a tab, the panel stops switching on its own until the next run.
  const [touched, setTouched] = useState(false);
  // Which round each tab shows; a tab with a second page opens on it when round 2 starts.
  const [rounds, setRounds] = useState<Record<string, 1 | 2>>({});
  const { points, error } = useMapPoints(tab === "scout");
  const about = useAbout();
  const threshold = about?.second_look.threshold ?? 0.5;
  const started: Record<RoundTab, boolean> = {
    clerk: Boolean(look?.query),
    translator: round2.translator !== undefined,
    scout: round2.scout !== undefined,
    judge: round2.judge !== undefined,
  };
  const startedKey = ROUND_TABS.map((id) => (started[id] ? "1" : "0")).join("");
  const wasStarted = useRef("0000");
  useEffect(() => {
    const changed: Record<string, 1 | 2> = {};
    ROUND_TABS.forEach((id, i) => {
      if (startedKey[i] !== wasStarted.current[i]) changed[id] = startedKey[i] === "1" ? 2 : 1;
    });
    wasStarted.current = startedKey;
    if (Object.keys(changed).length > 0) setRounds((now) => ({ ...now, ...changed }));
  }, [startedKey]);
  const hasSecond = (id: string): id is RoundTab =>
    (ROUND_TABS as readonly string[]).includes(id) && started[id as RoundTab];
  const view: 1 | 2 = hasSecond(tab) ? (rounds[tab] ?? 2) : 1;
  const phases = Object.values(states);
  const phase = (id: string): Phase =>
    id === "clerk"
      ? phases.includes("error")
        ? "error"
        : states.storyteller === "done"
          ? "done"
          : phases.length > 0
            ? "working"
            : "waiting"
      : (states[id] ?? "waiting");
  // Follow the newest step whose results are in, and show the answer when it first appears.
  const latest = [...FOLLOWED].reverse().find((id) => phase(id) === "done");
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
  const copy = {
    clerk: clerkCopy(about),
    translator: askTranslatorCopy(about),
    scout: scoutCopy(about),
    judge: judgeCopy(about),
    storyteller: storytellerCopy(about),
  }[tab === "answer" ? "clerk" : tab];
  const kept = (judge ?? []).filter((r) => r.kept).sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
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
  // Round 1 is finished once its results are in, even while the second look runs.
  const done1 =
    tab === "judge" ? judge !== null : phase(tab) === "done" || (hasSecond(tab) && tab !== "clerk");
  const overlay1: MapOverlay = { question: overlay?.question, candidates: overlay?.candidates };
  const overlay2: MapOverlay = {
    question: overlay?.question,
    followUp: overlay?.followUp,
    followUpCandidates: overlay?.followUpCandidates,
  };

  return (
    <div className={`panel ${styles.root}`} role="group" aria-labelledby="ans-h">
      <div className={styles.head}>
        <h2 id="ans-h">Answer</h2>
        <div
          role="group"
          aria-label="The characters and the answer"
          className={styles.tabs}
        >
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={tab === s.id}
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
            <CharacterCard
              name={step.name}
              room="/office/ask-room.svg"
              part={step.part}
              role={copy.role}
              phase={phase(tab)}
              plain={copy.plain}
              tech={copy.tech}
              how={copy.how}
              settings={copy.settings}
              extra={
                tab === "storyteller" && (
                  <>
                    <details>
                      <summary>The rules we give the model</summary>
                      <pre>{about?.storyteller_prompt ?? "…"}</pre>
                    </details>
                    <details>
                      <summary>The exact message sent this time</summary>
                      {sentPrompt ? (
                        <pre>{sentPrompt}</pre>
                      ) : (
                        <p>Ask a question to see the message.</p>
                      )}
                    </details>
                  </>
                )
              }
              thisRun={
                <>
                  {hasSecond(tab) && (
                    <RoundSwitch
                      round={view}
                      onChange={(round) => setRounds((now) => ({ ...now, [tab]: round }))}
                    />
                  )}

                  {view === 2 && tab === "clerk" && look?.query && (
                    <>
                      <div className={styles.askedCard}>
                        <span>On the board</span>
                        <p>{look.query}</p>
                      </div>
                      <div className={styles.block}>
                        <h3>Who decided</h3>
                        {look.enough !== null ? (
                          <>
                            <p>Mercury Decide: {Math.round(look.enough * 100)}% sure the sources were enough</p>
                            <div className={styles.meter}>
                              <div className={styles.meterTrack}>
                                <div
                                  className={styles.meterFill}
                                  data-testid="decide-meter-fill"
                                  style={{ width: `${look.enough * 100}%` }}
                                />
                                <div
                                  className={styles.meterTick}
                                  data-testid="decide-meter-tick"
                                  style={{ left: `${threshold * 100}%` }}
                                >
                                  <span>needs {Math.round(threshold * 100)}%</span>
                                </div>
                              </div>
                            </div>
                            {look.decidedBy === "llm" && !look.query && (
                              <p>The language model decided the sources were enough.</p>
                            )}
                          </>
                        ) : (
                          <>
                            <div className={styles.chips}>
                              <span className={styles.chipSoft}>Decided by the language model</span>
                            </div>
                            <p>The language model decided.</p>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {view === 2 && tab !== "clerk" && round2[tab] !== "done" && (
                    <p className={styles.empty}>Working on it…</p>
                  )}

                  {view === 2 && tab === "translator" && round2.translator === "done" && (
                    <div className={styles.block}>
                      <p>Fingerprinted the Clerk's new query: “{translator2?.query}”</p>
                      <p className={styles.empty}>
                        Word weights are only worked out for your own question (see Initial).
                      </p>
                    </div>
                  )}

                  {view === 2 && tab === "scout" && round2.scout === "done" && scout2 && (
                    <ScoutPage
                      results={scout2.results}
                      overlay={overlay2}
                      points={points}
                      error={error}
                      skipped={scout2.skipped}
                    />
                  )}

                  {view === 2 && tab === "judge" && round2.judge === "done" && judge2 && (
                    <>
                      <JudgeVerdict
                        results={judge2.results}
                        title={`New cards, ranked against “${judge2.query}”`}
                        none="None of the new cards were kept."
                      />
                      <div className={styles.block}>
                        <h3>Handed to the Storyteller</h3>
                        <ol className={styles.rows}>
                          {judge2.finalCards.map((c) => (
                            <li key={c.n}>
                              <span className={styles.num}>{c.n}</span>
                              <span className={styles.name}>{where(c)}</span>
                              <span className={`${styles.mono} ${styles.roundTag}`}>
                                {c.round === 1 ? "Initial" : "Second look"}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </>
                  )}

                  {view === 1 && (
                    <>
                      {tab === "clerk" && askedQuestion ? (
                        <>
                          <div className={styles.askedCard}>
                            <span>You asked</span>
                            <p>{askedQuestion}</p>
                          </div>
                          <div className={styles.chips}>
                            <span className={styles.chipSoft}>
                              Cards from your folder searched: {privateSent > 0 ? privateSent : "none"}
                            </span>
                          </div>
                        </>
                      ) : (
                        !done1 && (
                          <p className={styles.empty}>
                            {phase(tab) === "error"
                              ? "This step did not finish."
                              : phase(tab) === "working"
                                ? "Working on it…"
                                : NOTHING_YET_ASK}
                          </p>
                        )
                      )}

                      {done1 && tab === "translator" && (
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

                      {done1 && tab === "scout" && (
                        <ScoutPage
                          results={scout ?? []}
                          overlay={overlay1}
                          points={points}
                          error={error}
                        />
                      )}

                      {done1 && tab === "judge" && (
                        <>
                          {kept.length > 0 && look?.query && (
                            <div className={styles.banner}>
                              <p>
                                <strong>
                                  Not enough to answer yet. Second look: searching for “{look.query}”
                                </strong>
                              </p>
                              <p>{decidedLine(look)}</p>
                              {round2.judge === "done" ? (
                                <button
                                  type="button"
                                  onClick={() => setRounds((now) => ({ ...now, judge: 2 }))}
                                >
                                  See the second look
                                </button>
                              ) : (
                                <p className={styles.empty}>The second look is running…</p>
                              )}
                            </div>
                          )}
                          {kept.length > 0 &&
                            !look?.query &&
                            (look !== null || phase("judge") !== "working") && (
                              <div className={styles.banner}>
                                <p>
                                  <strong>Enough to answer. These cards go to the Storyteller.</strong>
                                </p>
                                {look && <p>{decidedLine(look)}</p>}
                              </div>
                            )}
                          <JudgeVerdict
                            results={judge ?? []}
                            title={`Kept: the best ${kept.length} of ${judge?.length ?? 0}`}
                            none="None of the cards answered the question, so the Judge kept nothing."
                          />
                        </>
                      )}

                      {phase(tab) === "done" && tab === "storyteller" && answer && (
                        <ol className={styles.rows}>
                          {citations.length === 0 ? (
                            <li className={styles.empty}>Nothing was cited.</li>
                          ) : (
                            citations.map((c) => (
                              <li key={c.n}>
                                <span className={styles.num}>{c.n}</span>
                                <span className={styles.name}>{c.title}</span>
                                <span className={styles.mono}>card {c.position + 1}</span>
                              </li>
                            ))
                          )}
                        </ol>
                      )}
                    </>
                  )}
                </>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
