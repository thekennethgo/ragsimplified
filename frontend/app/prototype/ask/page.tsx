"use client";

import { type FormEvent, useEffect, useState } from "react";

import { AnswerText } from "../../../components/ask/AnswerBubble";
import { askGeometry } from "../../../components/office/askGeometry";
import { AskOfficeScene } from "../../../components/office/AskOfficeScene";
import { type Citation, type StepState, type Word } from "../../../lib/ask";
import { backendUrl, readEvents } from "../../../lib/backend";
import { usePrivateTexts } from "../../../lib/PrivateTexts";
import styles from "./office.module.css";

// Prototype of the office Ask page from the design canvas. It talks to the real /ask stream;
// the existing /ask page is left untouched.

const MAX_PRIVATE_CHUNKS = 60;
const STEPS = ["translator", "scout", "judge", "storyteller"] as const;
type Step = (typeof STEPS)[number];
type Phase = "idle" | "desk" | Step | "done" | "nothing";
type Tab = Step | "answer";

type ScoutResult = {
  rank: number;
  title: string;
  heading: string | null;
  found_by: "vector" | "keyword" | "both";
  matched_words: string[] | null;
};
type JudgeResult = {
  n: number | null;
  kept: boolean;
  old_rank: number | null;
  new_rank: number | null;
  rerank_score: number | null;
  title: string;
  heading: string | null;
};
type LibraryDocument = { id: number; title: string; chunk_count: number };
type MapPoint = { chunk_id: number; document_id: number; title: string; x: number; y: number };

const NAMES: Record<Step, string> = {
  translator: "Translator",
  scout: "Scout",
  judge: "Judge",
  storyteller: "Storyteller",
};

const EXPLAIN: Record<Step, { title: string; text: string; term: string }> = {
  translator: {
    title: "turns your question into a fingerprint",
    text: "The fingerprint is a list of 1,024 numbers that captures what the question means, so the library can be searched by meaning.",
    term: "embedding the query",
  },
  scout: {
    title: "searches the library two ways",
    text: "By meaning (cards whose fingerprints are closest) and by matching words (cards that contain the same words). The Librarian points to the right shelves.",
    term: "hybrid retrieval: vector search + keyword search",
  },
  judge: {
    title: "re-reads the finds and keeps the best",
    text: "Search is fast but rough. The Judge reads each card next to your question and scores how well it actually answers it.",
    term: "reranking",
  },
  storyteller: {
    title: "writes the answer from the kept cards only",
    text: "The language model may only use the kept cards and must number each one it uses. If they don't cover the question, it says so.",
    term: "grounded generation with citations",
  },
};

// Where each character's speech bubble sits over the scene (percent of the scene box).
const BUBBLES: Record<string, { left: number; bottom: number; tail: number }> = {
  translator: { left: 22, bottom: 50.8, tail: 74 },
  scout: { left: 36, bottom: 61.5, tail: 92 },
  librarian: { left: 49, bottom: 76.8, tail: 8 },
  judge: { left: 54.4, bottom: 39.5, tail: 50 },
  storyteller: { left: 71.25, bottom: 36.2, tail: 50 },
};

const SHELF_COLOURS = ["#6F7F96", "#B9A26E", "#6F8A6E", "#9A6B5F", "#85788F", "#A88865", "#56677A"];

export default function OfficeAskPage() {
  const { texts } = usePrivateTexts();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Partial<Record<Step, StepState>>>({});
  const [words, setWords] = useState<Word[]>([]);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [scout, setScout] = useState<ScoutResult[]>([]);
  const [judged, setJudged] = useState<JudgeResult[]>([]);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("translator");
  const [libView, setLibView] = useState<"map" | "docs">("map");
  const [library, setLibrary] = useState<LibraryDocument[]>([]);
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);

  useEffect(() => {
    fetch(`${backendUrl()}/library`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setLibrary)
      .catch(() => setLibrary([]));
    fetch(`${backendUrl()}/map`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMapPoints)
      .catch(() => setMapPoints([]));
  }, []);

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

  function sourceHref(c: Citation): string | null {
    if (c.source === "library") {
      return c.document_id === null ? null : `/library/${c.document_id}?chunk=${c.position}`;
    }
    const index = texts.findIndex((item) => item.title === c.title);
    return index === -1 ? null : `/texts/${index}?chunk=${c.position}`;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setAsked(question);
    setError(null);
    setSteps({});
    setWords([]);
    setPoint(null);
    setScout([]);
    setJudged([]);
    setAnswer("");
    setCitations([]);
    setSelected(null);
    setTab("translator");
    try {
      const response = await fetch(`${backendUrl()}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, private_chunks: privateChunks }),
      });
      if (!response.ok) {
        setError(`The question was rejected (${response.status}).`);
        return;
      }
      for await (const e of readEvents(response)) {
        if ("delta" in e) {
          setAnswer((text) => text + e.delta);
          continue;
        }
        if (e.step === "error") {
          setError(String(e.data?.message ?? "Something went wrong."));
          setSteps((now) =>
            Object.fromEntries(
              Object.entries(now).map(([s, state]) => [s, state === "working" ? "error" : state]),
            ),
          );
          continue;
        }
        const step = e.step as Step;
        setSteps((now) => ({ ...now, [step]: e.status === "start" ? "working" : "done" }));
        if (e.status !== "done") continue;
        if (step === "translator") {
          setWords((e.data?.words ?? []) as Word[]);
          setPoint((e.data?.point as { x: number; y: number } | undefined) ?? null);
        } else if (step === "scout") {
          setScout((e.data?.results ?? []) as ScoutResult[]);
        } else if (step === "judge") {
          setJudged((e.data?.results ?? []) as JudgeResult[]);
        } else if (step === "storyteller" && e.data) {
          setAnswer(String(e.data.answer ?? ""));
          setCitations((e.data.citations ?? []) as Citation[]);
        }
      }
    } catch {
      setError("Could not reach the backend.");
    } finally {
      setBusy(false);
    }
  }

  const kept = judged.filter((r) => r.kept);
  const stateOf = (s: Step): StepState => steps[s] ?? "waiting";
  const working = STEPS.find((s) => stateOf(s) === "working");
  let phase: Phase = "idle";
  if (busy) phase = working ?? "desk";
  if (stateOf("storyteller") === "done") phase = kept.length === 0 ? "nothing" : "done";

  const geo = askGeometry();
  const inRoom = phase !== "idle" && phase !== "done" && phase !== "nothing";
  const clerkSpot = STEPS.includes(phase as Step) ? geo.spots[phase] : geo.spots.door;
  const foundSomething = scout.length > 0 && phase !== "nothing";

  const clerkSays = error
    ? `Sorry, something went wrong in the office: ${error}`
    : {
        idle: "Hi, I'm the Clerk. Ask me anything about the library and I'll go ask the team.",
        desk: `Got it: "${asked}". Heading into the office now.`,
        done: "I'm back! The answer is on the right, and the tabs show what each colleague did.",
        nothing:
          "Sorry, nobody could find that in the library, so I won't guess. Try something on the shelves.",
      }[phase as "idle" | "desk" | "done" | "nothing"] ??
      `I'm at the ${NAMES[phase as Step]}'s desk. Back soon.`;

  const speaking: { key: string; name: string; say: string }[] =
    phase === "translator"
      ? [{ key: "translator", name: "Translator", say: "Turning your question into a fingerprint…" }]
      : phase === "scout"
        ? [
            { key: "scout", name: "Scout", say: "Searching by meaning and by matching words…" },
            { key: "librarian", name: "Librarian", say: "Pointing the Scout to the right shelves." },
          ]
        : phase === "judge"
          ? [{ key: "judge", name: "Judge", say: `Reading all ${scout.length} cards next to your question…` }]
          : phase === "storyteller"
            ? [{ key: "storyteller", name: "Storyteller", say: "Writing the answer from the kept cards…" }]
            : [];

  const counts = {
    vector: scout.filter((r) => r.found_by === "vector").length,
    keyword: scout.filter((r) => r.found_by === "keyword").length,
    both: scout.filter((r) => r.found_by === "both").length,
  };
  const cited = new Set(citations.map((c) => c.n));

  // Fit the library's map points (and the question) into the panel.
  const allX = mapPoints.map((p) => p.x).concat(point ? [point.x] : []);
  const allY = mapPoints.map((p) => p.y).concat(point ? [point.y] : []);
  const [minX, maxX, minY, maxY] = [Math.min(...allX), Math.max(...allX), Math.min(...allY), Math.max(...allY)];
  const toPct = (v: number, lo: number, hi: number) => (hi > lo ? 4 + ((v - lo) / (hi - lo)) * 92 : 50);
  const docColour = new Map(library.map((d, i) => [d.id, SHELF_COLOURS[i % SHELF_COLOURS.length]]));

  function stepReady(s: Step): boolean {
    if (stateOf(s) !== "done") return false;
    return s === "translator" || phase !== "nothing";
  }

  function emptyText(s: Step): string {
    if (stateOf(s) === "working") return "Working on it now. The Clerk is at this desk.";
    if (phase === "nothing") return "Nothing in the library was close enough, so there was nothing to do here.";
    return "Ask the Clerk a question to see this step.";
  }

  return (
    <div className={styles.page}>
      <section aria-labelledby="office-h" className={styles.scene}>
        <h1 id="office-h" className={styles.sceneTitle}>
          The office · asking
        </h1>
        <AskOfficeScene
          beamOpacity={foundSomething ? 1 : 0}
          rankOpacity={kept.length > 0 ? 1 : 0}
          tossedOpacity={kept.length > 0 ? 0.8 : 0}
          answerOpacity={phase === "done" ? 1 : 0}
          clerk={clerkSpot}
          clerkOpacity={inRoom ? 1 : 0}
        />
        {speaking.map((b) => (
          <div
            key={b.key}
            className={styles.bubble}
            style={{ left: `${BUBBLES[b.key].left}%`, bottom: `${BUBBLES[b.key].bottom}%` }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
              <strong style={{ fontSize: 13 }}>{b.name}</strong>
              <span className={styles.chip}>Working</span>
            </div>
            <p>{b.say}</p>
            <span className={styles.tail} style={{ left: `${BUBBLES[b.key].tail}%` }} />
          </div>
        ))}
      </section>

      <div className={styles.row}>
        <form aria-labelledby="ask-h" className={styles.askBox} onSubmit={onSubmit}>
          <h2 id="ask-h" style={{ fontSize: 20 }}>
            Ask the library
          </h2>
          <div className={styles.clerkRow}>
            <div className={styles.clerk} aria-hidden="true" style={{ opacity: inRoom ? 0.35 : 1 }}>
              <span className={styles.clerkHead} />
              <span className={styles.clerkBody} />
              <span className={styles.clerkTag}>CLERK</span>
            </div>
            <p className={styles.says} aria-live="polite">
              {clerkSays}
            </p>
          </div>
          <label className={styles.field}>
            Your question
            <textarea
              rows={3}
              maxLength={500}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. How did the M1 chip change MacBook battery life?"
            />
          </label>
          <button type="submit" className={styles.primary} disabled={busy || !question.trim()}>
            {busy ? "Asking…" : "Ask"}
          </button>
          <p className={styles.note}>
            Your question{texts.length > 0 ? ` and your ${texts.length} pasted text(s)` : ""} are sent to Voyage AI
            and to the language model provider.
          </p>
        </form>

        <section id="answer" aria-labelledby="ans-h" className={styles.answerBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 id="ans-h" style={{ fontSize: 20 }}>
              Answer
            </h2>
            <div role="group" aria-label="Answer and the steps that produced it" className={styles.tabs} style={{ marginLeft: "auto" }}>
              {[...STEPS, "answer" as const].map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tab === t}
                  className={`${styles.tab} ${tab === t ? styles.tabOn : ""}`}
                  onClick={() => setTab(t)}
                >
                  {t !== "answer" && <span className={styles.dot} data-state={stateOf(t)} title={stateOf(t)} />}
                  {t === "answer" ? "Answer" : NAMES[t]}
                </button>
              ))}
            </div>
          </div>

          {tab !== "answer" && (
            <div className={styles.explain}>
              <p style={{ fontWeight: 600 }}>
                {NAMES[tab]} · {EXPLAIN[tab].title}
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.55 }}>{EXPLAIN[tab].text}</p>
              <p className={styles.note}>
                In RAG terms: <strong style={{ color: "#33261D" }}>{EXPLAIN[tab].term}</strong>
              </p>
            </div>
          )}

          {tab !== "answer" && !stepReady(tab) && <p className={styles.empty}>{emptyText(tab)}</p>}

          {tab === "translator" && stepReady("translator") && (
            <div>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>Which words mattered · darker = shaped the meaning more</h3>
              <p aria-label="Question words by influence" style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 16 }}>
                {words.map((w, i) => {
                  const v = w.influence ?? 0;
                  return (
                    <span
                      key={i}
                      className={styles.word}
                      title={w.influence === null ? "Not measured" : `Influence ${Math.round(v * 100)}%`}
                      style={{ background: `rgba(122, 82, 54, ${0.08 + v * 0.85})`, color: v > 0.55 ? "#fff" : "#33261D" }}
                    >
                      {w.text}
                    </span>
                  );
                })}
              </p>
            </div>
          )}

          {tab === "scout" && stepReady("scout") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p className={styles.note}>
                {scout.length} cards found: {counts.vector + counts.both} by meaning, {counts.keyword + counts.both} by
                matching words, {counts.both} both ways.
              </p>
              <ol className={styles.list}>
                {scout.map((r) => (
                  <li key={r.rank} className={styles.item}>
                    <span className={styles.mono}>#{r.rank}</span>
                    <span style={{ fontWeight: 600 }}>{r.title}</span>
                    {r.heading && <span className={styles.mono}>· {r.heading}</span>}
                    {r.found_by !== "keyword" && <span className={styles.byMeaning}>by meaning</span>}
                    {r.found_by !== "vector" && (
                      <span className={styles.byWords}>
                        by words{r.matched_words?.length ? `: ${r.matched_words.join(", ")}` : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {tab === "judge" && stepReady("judge") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h3 style={{ fontSize: 14 }}>
                Kept: {kept.length} of {judged.length}
              </h3>
              <ol className={styles.list}>
                {kept.map((r) => (
                  <li key={`${r.title}-${r.new_rank}`} className={styles.item} title={`Score ${r.rerank_score ?? "–"}`}>
                    <span className={styles.badge}>{r.new_rank}</span>
                    <span style={{ fontWeight: 600, flex: 1 }}>
                      {r.title} {r.heading && <span className={styles.mono}>· {r.heading}</span>}
                    </span>
                    <span className={styles.bar}>
                      <span style={{ width: `${Math.round((r.rerank_score ?? 0) * 100)}%` }} />
                    </span>
                    <span className={styles.mono}>was #{r.old_rank}</span>
                  </li>
                ))}
              </ol>
              <p className={styles.note}>Set aside: {judged.length - kept.length} cards.</p>
            </div>
          )}

          {tab === "storyteller" && stepReady("storyteller") && (
            <ol className={styles.list}>
              {kept.map((r) => (
                <li key={`${r.title}-${r.n}`} className={styles.item} style={{ opacity: r.n && cited.has(r.n) ? 1 : 0.6 }}>
                  <span className={styles.badge}>{r.n}</span>
                  <span style={{ fontWeight: 600, flex: 1 }}>{r.title}</span>
                  <span className={styles.note}>{r.n && cited.has(r.n) ? `cited as [${r.n}]` : "read, not needed"}</span>
                </li>
              ))}
            </ol>
          )}

          {tab === "answer" && (
            <div className={styles.row}>
              <div style={{ flex: "999 1 340px", minWidth: 0 }}>
                {answer ? (
                  <div className={styles.answerText}>
                    <AnswerText answer={answer} citations={citations} onOpen={setSelected} />
                  </div>
                ) : (
                  <p className={styles.empty}>Ask the Clerk a question and the answer appears here, with numbered sources.</p>
                )}
              </div>
              <aside aria-label="Sources" style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 8 }}>
                <h3 style={{ fontSize: 15 }}>Sources</h3>
                {citations.length === 0 && <p className={styles.note}>No sources yet.</p>}
                {citations.map((c) => {
                  const href = sourceHref(c);
                  return (
                    <div
                      key={c.n}
                      className={styles.explain}
                      style={{ border: selected === c.n ? "2px solid #7A5236" : undefined }}
                    >
                      <p style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span className={styles.badge}>{c.n}</span>
                        <strong style={{ fontSize: 14 }}>{c.title}</strong>
                      </p>
                      <p style={{ fontSize: 13, lineHeight: 1.5 }}>{c.snippet}</p>
                      {href && (
                        <a href={href} style={{ fontSize: 13, color: "#6B4429" }}>
                          Open the source
                        </a>
                      )}
                    </div>
                  );
                })}
              </aside>
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="lib-h" className={styles.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 id="lib-h" style={{ fontSize: 20 }}>
            Library
          </h2>
          <span className={styles.note}>
            {library.length} starter books{texts.length > 0 ? `, ${texts.length} of yours` : ""}
          </span>
          <div role="group" aria-label="Library view" className={styles.tabs} style={{ marginLeft: "auto" }}>
            <button type="button" aria-pressed={libView === "map"} className={`${styles.tab} ${libView === "map" ? styles.tabOn : ""}`} onClick={() => setLibView("map")}>
              Vector map
            </button>
            <button type="button" aria-pressed={libView === "docs"} className={`${styles.tab} ${libView === "docs" ? styles.tabOn : ""}`} onClick={() => setLibView("docs")}>
              Documents
            </button>
          </div>
        </div>

        {libView === "map" && (
          <>
            <div className={styles.map}>
              {mapPoints.map((p) => (
                <span
                  key={p.chunk_id}
                  className={styles.mapDot}
                  title={p.title}
                  style={{
                    left: `${toPct(p.x, minX, maxX)}%`,
                    top: `${100 - toPct(p.y, minY, maxY)}%`,
                    background: docColour.get(p.document_id) ?? "#B5A68C",
                  }}
                />
              ))}
              {point && (
                <span
                  className={styles.question}
                  title="Your question"
                  style={{ left: `${toPct(point.x, minX, maxX)}%`, top: `${100 - toPct(point.y, minY, maxY)}%` }}
                />
              )}
            </div>
            <p className={styles.note}>
              Each dot is one card. The map flattens 1,024 numbers to 2-D, so distances are only approximate.
              {point ? " The dark diamond is your question." : ""}
            </p>
          </>
        )}

        {libView === "docs" && (
          <ul className={styles.list}>
            {texts.map((t, i) => (
              <li key={`mine-${i}`} className={styles.item}>
                <strong>{t.title}</strong>
                <span className={styles.mono}>your book · {t.chunks.length} cards · this tab only</span>
              </li>
            ))}
            {library.map((d) => (
              <li key={d.id} className={styles.item}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: docColour.get(d.id) }} />
                <span style={{ flex: 1 }}>{d.title}</span>
                <span className={styles.mono}>{d.chunk_count} cards</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
