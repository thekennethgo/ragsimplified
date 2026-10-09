"use client";

import Link from "next/link";
import { useState } from "react";

import type { Citation, JudgeResult, ScoutResult, Word } from "../../lib/ask";
import type { Phase } from "../../lib/sceneState";
import { AnswerBubble } from "./AnswerBubble";
import styles from "./AnswerPanel.module.css";
import { HighlightedWords } from "./QuestionBubble";

type TabId = "translator" | "scout" | "judge" | "storyteller" | "answer";

const STEPS = [
  {
    id: "translator",
    name: "Translator",
    title: "fingerprints your question",
    text: "A fingerprint is 1,024 numbers for what the question means. Similar meaning, similar numbers, so the cabinet can be searched by meaning.",
    term: "embedding the query",
  },
  {
    id: "scout",
    name: "Scout",
    title: "searches two ways",
    text: "By meaning (closest fingerprints) and by words (same words), then pulls the cards.",
    term: "hybrid search: vector + keyword",
  },
  {
    id: "judge",
    name: "Judge",
    title: "keeps the best cards",
    text: "Search is fast but rough. The Judge reads each card next to your question and scores how well it answers.",
    term: "reranking",
  },
  {
    id: "storyteller",
    name: "Storyteller",
    title: "writes the answer from those cards",
    text: "Only from the kept cards, each one numbered. If they don't cover it, it says so instead of guessing.",
    term: "grounded generation with citations",
  },
] as const;

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
  nothingFound,
  hrefFor,
  onOpenSource,
  onShowSources,
}: {
  states: Record<string, Phase>;
  answer: string;
  citations: Citation[];
  words: Word[];
  scout: ScoutResult[] | null;
  judge: JudgeResult[] | null;
  nothingFound: boolean;
  hrefFor: (citation: Citation) => string | null;
  onOpenSource: (n: number) => void;
  onShowSources: () => void;
}) {
  const [tab, setTab] = useState<TabId>("answer");
  const phase = (id: string): Phase => states[id] ?? "waiting";
  const step = STEPS.find((s) => s.id === tab);
  const kept = (judge ?? []).filter((r) => r.kept).sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
  const setAside = (judge ?? []).filter((r) => !r.kept);
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
              disabled={phase(s.id) !== "done"}
              onClick={() => setTab(s.id)}
            >
              <span className={`${styles.dot} ${styles[phase(s.id)]}`} title={phase(s.id)} />
              {s.name}
            </button>
          ))}
          <button type="button" aria-pressed={tab === "answer"} onClick={() => setTab("answer")}>
            Answer
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {tab === "answer" && (
          <div className={styles.answerTab}>
            <div className={styles.answerCol}>
              {answer ? (
                <AnswerBubble
                  answer={answer}
                  citations={citations}
                  onOpenSource={onOpenSource}
                  onShowSources={onShowSources}
                />
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
                    const href = hrefFor(c);
                    return (
                      <li key={c.n}>
                        <div className={styles.cardHead}>
                          <span className={styles.num}>{c.n}</span>
                          <span className={styles.name}>{c.title}</span>
                          <span className={styles.mono}>card {c.position + 1}</span>
                        </div>
                        <p className={styles.snippet}>{c.snippet}</p>
                        {href && <Link href={href}>Open in the file cabinet</Link>}
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

            {tab === "translator" && (
              <div className={styles.block}>
                <h3>
                  Which words mattered <span>· darker = shaped the meaning more</span>
                </h3>
                <HighlightedWords words={words} />
              </div>
            )}

            {tab === "scout" && (
              <div className={styles.block}>
                <div className={styles.chips}>
                  <span className={styles.chipDark}>{scout?.length ?? 0} cards found</span>
                  <span className={styles.chipMeaning}>
                    {foundBy("vector") + foundBy("both")} by meaning
                  </span>
                  <span className={styles.chipWords}>
                    {foundBy("keyword") + foundBy("both")} by matching words
                  </span>
                  <span className={styles.chipSoft}>{foundBy("both")} found both ways</span>
                </div>
                <ol className={styles.rows}>
                  {(scout ?? []).map((r) => (
                    <li key={r.rank}>
                      <span className={styles.num}>{r.rank}</span>
                      <span className={styles.name}>{where(r)}</span>
                      <span className={styles.mono}>
                        {r.score.toFixed(3)} · found by{" "}
                        {r.found_by === "vector"
                          ? "meaning"
                          : r.found_by === "keyword"
                            ? "words"
                            : "both"}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {tab === "judge" && (
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

            {tab === "storyteller" && (
              <div className={styles.block}>
                {nothingFound ? (
                  <p className={styles.empty}>Nothing to write from, so no answer.</p>
                ) : (
                  <ol className={styles.rows}>
                    {citations.map((c) => (
                      <li key={c.n}>
                        <span className={styles.num}>{c.n}</span>
                        <span className={styles.name}>{where(c)}</span>
                        <span className={styles.cited}>cited as [{c.n}]</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
