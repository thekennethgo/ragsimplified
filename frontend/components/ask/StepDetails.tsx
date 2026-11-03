"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

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
  judgeCopy,
  NOTHING_YET_ASK,
  scoutCopy,
  storytellerCopy,
} from "../../lib/characters";
import { FOUND_BY_COLOR, keyOf, useMapPoints, type MapOverlay, type MapPoint } from "../../lib/map";
import type { Phase } from "../../lib/sceneState";
import CharacterCard from "../characters/CharacterCard";
import VectorMap from "../map/VectorMap";
import { showSelectedTab } from "../../lib/tabRow";
import styles from "./StepDetails.module.css";
import { HighlightedWords } from "./QuestionBubble";

export type TabId = "answer" | "translator" | "scout" | "judge" | "storyteller";

const STEPS = [
  { id: "translator", name: "Translator", part: "tr" },
  { id: "scout", name: "Scout", part: "sc" },
  { id: "judge", name: "Judge", part: "jd" },
  { id: "storyteller", name: "Storyteller", part: "st" },
] as const;

/** The steps, in the order the backend reports them. */
const FOLLOWED = ["translator", "scout", "judge", "storyteller"] as const;

const FILLER = new Set(["a","an","the","is","are","was","were","be","been","of","in","on","at","to","for","and","or","but","with","by","from","as","it","its","this","that","these","those","what","which","who","whom","whose","when","where","why","how","do","does","did","can","could","should","would","will","i","you","he","she","we","they","me","my","your","our","their","about","into","than","then","there","so","if","not","no","any","some"]);

const where = (r: { title: string; heading: string | null; page: number | null }, part: string) =>
  [r.title, r.heading, r.page !== null ? `page ${r.page}` : null, part].filter(Boolean).join(" · ");

/** "part 3 of 12" for a card; the page builds it from the library and the visitor's texts. */
export type PartOf = (r: {
  source: "library" | "private";
  document_id: number | null;
  title: string;
  position: number;
}) => string;

/** The tabs that get a second page when a second look happens. */
const ROUND_TABS = ["translator", "scout", "judge"] as const;
type RoundTab = (typeof ROUND_TABS)[number];

/** Who decided whether the cards were enough, and why, in one line. */
function decidedLine(look: Look, threshold: number, nothingThreshold: number): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  if (look.nothing && look.relevant !== null) {
    return `Mercury Decide was only ${pct(look.relevant)} sure the cards mention anything in your question (it stops below ${pct(nothingThreshold)}), so no answer was written.`;
  }
  if (look.enough === null) {
    return look.query
      ? "The language model read the cards, found something missing, and wrote a follow-up search."
      : "The language model read the cards and found them enough.";
  }
  if (look.decidedBy === "decider") {
    return `Mercury Decide was ${pct(look.enough)} sure the cards fully answer the question (it needs ${pct(threshold)}), so no second search was needed.`;
  }
  return look.query
    ? `Mercury Decide was only ${pct(look.enough)} sure the cards fully answer the question (it needs ${pct(threshold)}), so the language model wrote a follow-up search.`
    : `Mercury Decide was only ${pct(look.enough)} sure (it needs ${pct(threshold)}), but the language model found nothing to search for, so the cards go as they are.`;
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
  partOf,
  skipped = 0,
}: {
  results: ScoutResult[];
  partOf: PartOf;
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
            <span className={styles.name}>{where(r, partOf(r))}</span>
            <span className={styles.mono}>{r.score.toFixed(3)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The Judge's verdict on a list of candidates: the kept rows and the cards set aside. */
function JudgeVerdict({
  results,
  title,
  none,
  rule,
  maxPerDocument,
  partOf,
  offset = 0,
}: {
  partOf: PartOf;
  results: JudgeResult[];
  title: string;
  none: string;
  rule: string;
  maxPerDocument: string;
  offset?: number;
}) {
  const kept = results.filter((r) => r.kept).sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
  const setAside = results.filter((r) => !r.kept);
  const worstKept = Math.max(...kept.map((r) => r.new_rank));
  const score = (r: JudgeResult) => (r.rerank_score === null ? "" : `score ${r.rerank_score.toFixed(2)}`);
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
                <span className={styles.num}>{(r.n ?? 0) + offset}</span>
                <span className={styles.name}>{where(r, partOf(r))}</span>
                <span className={styles.mono}>
                  {r.rerank_score === null ? "" : `${score(r)} · `}was #{r.old_rank}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className={`${styles.block} ${styles.aside}`}>
        <h3>Set aside: {setAside.length} cards</h3>
        <p className={styles.rule}>{rule}</p>
        <ul>
          {setAside.map((r) => (
            <li key={`${r.old_rank}`}>
              {where(r, partOf(r))}
              {r.rerank_score !== null && <span className={styles.mono}> {score(r)}</span>}
              {r.new_rank < worstKept && (
                <span className={styles.empty}> {maxPerDocument} already from this document</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** "How it got there": one tab per step showing what it really did. */
export default function StepDetails({
  tab,
  onTab,
  states,
  played,
  answer,
  revealed,
  answerText,
  citations,
  words,
  scout,
  look = null,
  lookComing,
  translator2 = null,
  scout2 = null,
  judge2 = null,
  round2 = {},
  judge,
  follow,
  overlay,
  privateSent,
  sentPrompt,
  partOf,
  run = 0,
}: {
  partOf: PartOf;
  /** The open tab; the page owns it so it can open one from elsewhere. */
  tab: TabId;
  onTab: (tab: TabId) => void;
  states: Record<string, Phase>;
  /** What the office has played so far; the tab dots, chips and following use it, so the panel never runs ahead of the room. */
  played: Record<string, Phase>;
  /** The Answer tab's body: the page's answer card. */
  answer: ReactNode;
  /** True once the answer is shown to the visitor. */
  revealed: boolean;
  answerText: string;
  citations: Citation[];
  words: Word[];
  scout: ScoutResult[] | null;
  /** The second look: the check's outcome, each character's round 2 page, and its progress. */
  look?: Look | null;
  /** Round 1 asked for a second look that has not played yet. */
  lookComing: boolean;
  translator2?: TranslatorRound2 | null;
  scout2?: ScoutRound2 | null;
  judge2?: JudgeRound2 | null;
  round2?: Record<string, Phase>;
  judge: JudgeResult[] | null;
  /** Jump to each step as its results arrive (off when the animations are off). */
  follow: boolean;
  /** The question and the Scout's candidates, drawn on the Scout tab's map. */
  overlay?: MapOverlay;
  /** How many of the visitor's own cards went along with the question. */
  privateSent: number;
  /** The exact message the Storyteller's model was sent, once the backend has said. */
  sentPrompt: string | null;
  /** Changes with every new question, which hands the panel back to the steps. */
  run?: number;
}) {
  // Once the visitor picks a tab, the panel stops switching on its own until the next run.
  // A ref, set inside the click, so an effect left over from an earlier render cannot undo the pick.
  const touched = useRef(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => showSelectedTab(tabsRef.current), [tab]);
  // Which round each tab shows; a tab with a second page opens on it when round 2 starts.
  const [rounds, setRounds] = useState<Record<string, 1 | 2>>({});
  const { points, error } = useMapPoints(tab === "scout");
  const about = useAbout();
  const threshold = about?.second_look.threshold ?? 0.5;
  const nothingThreshold = about?.second_look.nothing_threshold ?? 0.1;
  const started: Record<RoundTab, boolean> = {
    translator: round2.translator !== undefined,
    scout: round2.scout !== undefined,
    judge: round2.judge !== undefined,
  };
  const startedKey = ROUND_TABS.map((id) => (started[id] ? "1" : "0")).join("");
  const wasStarted = useRef("000");
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
  const phase = (id: string): Phase => states[id] ?? "waiting";
  // Follow the newest step whose results are in; once the answer is there, stay where it is.
  const playedPhase = (id: string): Phase => played[id] ?? "waiting";
  // The last step still working, else the newest one done; so a second look never pulls the panel back.
  const lastWhere = (p: Phase) => [...FOLLOWED].reverse().find((id) => playedPhase(id) === p);
  const latest = lastWhere("working") ?? lastWhere("done");
  // The tab this panel last chose; any other change to `tab` came from the page (the step strip) and counts as a pick.
  const chosen = useRef(tab);
  useEffect(() => {
    touched.current = false;
    chosen.current = tab;
  }, [run]);
  useEffect(() => {
    if (tab !== chosen.current) touched.current = true;
  }, [tab]);
  useEffect(() => {
    if (touched.current || !follow) return;
    if (revealed) {
      chosen.current = "answer";
      onTab("answer");
    } else if (latest) {
      chosen.current = latest;
      onTab(latest);
    }
  }, [follow, latest, revealed, onTab]);
  const step = STEPS.find((s) => s.id === tab);
  const copy = {
    translator: askTranslatorCopy(about),
    scout: scoutCopy(about),
    judge: judgeCopy(about),
    storyteller: storytellerCopy(about),
  }[tab === "answer" ? "translator" : tab];
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
    tab === "judge" ? judge !== null : phase(tab) === "done" || hasSecond(tab);
  const overlay1: MapOverlay = { question: overlay?.question, candidates: overlay?.candidates };
  const overlay2: MapOverlay = {
    question: overlay?.question,
    followUp: overlay?.followUp,
    followUpCandidates: overlay?.followUpCandidates,
  };

  return (
    <section className={styles.root} aria-labelledby="steps-h">
      <div className={styles.head}>
        <h2 id="steps-h" className="visually-hidden">
          Answer and how it got there
        </h2>
        <div ref={tabsRef} role="group" aria-label="The characters" className={styles.tabs}>
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={tab === s.id}
              style={{ "--c": `var(--${s.id})` } as CSSProperties}
              onClick={() => {
                touched.current = true;
                onTab(s.id);
              }}
            >
              <span className={`${styles.dot} ${styles[playedPhase(s.id)]}`} title={playedPhase(s.id)} />
              {s.name}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={tab === "answer"}
            onClick={() => {
              touched.current = true;
              onTab("answer");
            }}
          >
            Answer
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {tab === "answer" && answer}
        {step && (
          <div className={styles.step}>
            <CharacterCard
              name={step.name}
              room="/office/ask-room.svg"
              part={step.part}
              role={copy.role}
              phase={playedPhase(tab)}
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

                  {view === 2 && round2[tab] !== "done" && (
                    <p className={styles.empty}>Working on it…</p>
                  )}

                  {view === 2 && tab === "judge" && look?.query && (
                    <>
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
                          </>
                        ) : null}
                        <p>{decidedLine(look, threshold, nothingThreshold)}</p>
                      </div>
                    </>
                  )}

                  {view === 2 && tab === "translator" && round2.translator === "done" && (
                    <div className={styles.block}>
                      <p className={styles.headline}>New search: “{translator2?.query}”</p>
                      <p className={styles.empty}>
                        Word weights are only worked out for your own question (see Initial).
                      </p>
                    </div>
                  )}

                  {view === 2 && tab === "scout" && round2.scout === "done" && scout2 && (
                    <ScoutPage
                      partOf={partOf}
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
                        partOf={partOf}
                        results={judge2.results}
                        title={`New cards, ranked against “${judge2.query}”`}
                        none="None of the new cards were kept."
                        rule={about ? `Only the best ${about.second_look.slots} new cards are added.` : "…"}
                        maxPerDocument={about ? String(about.judge.max_per_document) : "…"}
                        offset={judge2.finalCards.filter((c) => c.round === 1).length}
                      />
                      {judge2.check?.nothing && (
                        <div className={styles.banner}>
                          <p>
                            <strong>
                              Nothing in these cards answers the question, so no answer was written.
                            </strong>
                          </p>
                          {judge2.check.part !== null && (
                            <p>
                              Mercury Decide was only {Math.round(judge2.check.part * 100)}% sure
                              the cards answer any part of it.
                            </p>
                          )}
                        </div>
                      )}
                      <div className={styles.block}>
                        <h3>
                          {judge2.check?.nothing ? "Filed back, not handed over" : "Handed to the Storyteller"}
                        </h3>
                        <ol className={styles.rows}>
                          {judge2.finalCards.map((c) => (
                            <li key={c.n}>
                              <span className={styles.num}>{c.n}</span>
                              <span className={styles.name}>{where(c, partOf(c))}</span>
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
                      {tab === "scout" && (
                        <div className={styles.chips}>
                          <span className={styles.chipSoft}>
                            Cards from your folder searched: {privateSent > 0 ? privateSent : "none"}
                          </span>
                        </div>
                      )}

                      {!done1 && (
                        <p className={styles.empty}>
                          {phase(tab) === "error"
                            ? "This step did not finish."
                            : phase(tab) === "working"
                              ? "Working on it…"
                              : NOTHING_YET_ASK}
                        </p>
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
                      partOf={partOf}
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
                              <p>{decidedLine(look, threshold, nothingThreshold)}</p>
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
                          {kept.length > 0 && look?.nothing && (
                            <div className={styles.banner}>
                              <p>
                                <strong>Nothing on file about this, so no answer was written.</strong>
                              </p>
                              <p>{decidedLine(look, threshold, nothingThreshold)}</p>
                            </div>
                          )}
                          {kept.length > 0 &&
                            !look?.query &&
                            !look?.nothing &&
                            (look !== null || !lookComing) && (
                              <div className={styles.banner}>
                                <p>
                                  <strong>Enough to answer. These cards go to the Storyteller.</strong>
                                </p>
                                {look && <p>{decidedLine(look, threshold, nothingThreshold)}</p>}
                              </div>
                            )}
                          <JudgeVerdict
                        partOf={partOf}
                            results={judge ?? []}
                            title={`Kept: the best ${kept.length} of ${judge?.length ?? 0}`}
                            none="None of the cards answered the question, so the Judge kept nothing."
                            rule={
                              about
                                ? `Only the best ${about.judge.keep} are kept, at most ${about.judge.max_per_document} from one document.`
                                : "…"
                            }
                            maxPerDocument={about ? String(about.judge.max_per_document) : "…"}
                          />
                        </>
                      )}

                      {phase(tab) === "done" && tab === "storyteller" && answerText && (
                        <ol className={styles.rows}>
                          {citations.length === 0 ? (
                            <li className={styles.empty}>Nothing was cited.</li>
                          ) : (
                            citations.map((c) => (
                              <li key={c.n}>
                                <span className={styles.num}>{c.n}</span>
                                <span className={styles.name}>{c.title}</span>
                                <span className={styles.mono}>{partOf(c)}</span>
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
    </section>
  );
}
