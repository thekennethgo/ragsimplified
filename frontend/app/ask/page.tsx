"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useRef, useState } from "react";

import AnswerCard from "../../components/ask/AnswerCard";
import { QuestionBubble } from "../../components/ask/QuestionBubble";
import StepDetails, { type PartOf, type TabId } from "../../components/ask/StepDetails";
import LibraryPanel, { type LibraryDocument } from "../../components/LibraryPanel";
import AnimationToggle from "../../components/office/AnimationToggle";
import OfficeRoom from "../../components/office/OfficeRoom";
import SpeechBubble from "../../components/office/SpeechBubble";
import { useAbout } from "../../lib/about";
import {
  askTranslatorSays,
  judgeSays,
  scoutSays,
  storytellerSays,
} from "../../lib/characters";
import {
  type Citation,
  type FinalCard,
  type JudgeResult,
  type JudgeRound2,
  type Look,
  type ScoutResult,
  type ScoutRound2,
  type TranslatorRound2,
  type Word,
} from "../../lib/ask";
import { backendUrl, readEvents } from "../../lib/backend";
import type { MapOverlay, Point } from "../../lib/map";
import { useAnimationsSetting } from "../../lib/office/animationSetting";
import { buildAskScenes } from "../../lib/office/scenes/ask";
import { useFollow } from "../../lib/office/useFollow";
import { useSceneQueue } from "../../lib/office/useSceneQueue";
import { useBackendHealth } from "../../lib/health";
import { ASK_DOC_COUNT } from "../../lib/office-spots";
import { usePrivateTexts } from "../../lib/PrivateTexts";
import { SHELVES, shelfOf } from "../../lib/shelves";
import { type Phase, sceneReducer, toSceneEvents } from "../../lib/sceneState";
import type { ViewTarget } from "../../lib/viewer";
import styles from "./page.module.css";

// The backend accepts at most this many private chunks per question.
const MAX_PRIVATE_CHUNKS = 60;

const ASK_LABEL = "The Ask office: the Translator, Scout, Judge and Storyteller at work, with Meow, the office cat, asleep on the shelves, and a RAG.co rug on the floor.";

/** A card per shelf that has a document, in shelf order, with its starter questions. */
function examplesFor(docs: { filename: string }[] | null) {
  if (!docs) return [];
  const present = new Set(docs.map((doc) => shelfOf(doc.filename)));
  return SHELVES.filter((shelf) => present.has(shelf.id) && shelf.questions.length > 0).map(
    (shelf) => ({ shelf: shelf.name, color: shelf.color, questions: shelf.questions }),
  );
}

const CREW = ["translator", "scout", "judge", "storyteller"] as const;
const NAMES = {
  translator: "Translator",
  scout: "Scout",
  judge: "Judge",
  storyteller: "Storyteller",
} as const;

export default function AskPage() {
  return (
    <Suspense>
      <AskOffice />
    </Suspense>
  );
}

function AskOffice() {
  const [animationsOn, setAnimationsOn] = useAnimationsSetting();
  const onRef = useRef(animationsOn);
  onRef.current = animationsOn;
  const queue = useSceneQueue(() => !onRef.current);
  useEffect(() => {
    if (!animationsOn) {
      queue.skipAll();
      setRevealed(true);
      setLookPlayed(true);
    }
  }, [animationsOn, queue]);
  const officeRef = useRef<HTMLElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const { texts } = usePrivateTexts();
  // /ask?q=... opens with the question filled in (the Home page's "Ask the office about me").
  const prefilled = useSearchParams().get("q") ?? "";
  const [question, setQuestion] = useState(prefilled);
  const offline = useBackendHealth() === "offline";
  const [askedQuestion, setAskedQuestion] = useState("");
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerModel, setAnswerModel] = useState<string | null>(null);
  // The answer shows when the office reaches the Storyteller (or at once without the office).
  const [revealed, setRevealed] = useState(false);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [viewer, setViewer] = useState<ViewTarget | null>(null);
  const [tab, setTab] = useState<TabId>("answer");
  const [busy, setBusy] = useState(false);
  const [animating, setAnimating] = useState(false);
  // Under 760px the room picture is hidden until the visitor asks to watch.
  const [watching, setWatching] = useState(false);
  const [run, setRun] = useState(0);
  // `states` is what the backend has finished; `shown` is what the office has played so far.
  const [states, setStates] = useState<Record<string, Phase>>({});
  const [shown, setShown] = useState<Record<string, Phase>>({});
  const [words, setWords] = useState<Word[]>([]);
  const [scout, setScout] = useState<ScoutResult[] | null>(null);
  const [judge, setJudge] = useState<JudgeResult[] | null>(null);
  // The second look: the check's outcome, and each character's round 2 data and progress.
  const [look, setLook] = useState<Look | null>(null);
  // The second look's pages show once the office has played the Judge's check, not when the backend reports it.
  const [lookPlayed, setLookPlayed] = useState(false);
  const [lookComing, setLookComing] = useState(false);
  const [translator2, setTranslator2] = useState<TranslatorRound2 | null>(null);
  const [scout2, setScout2] = useState<ScoutRound2 | null>(null);
  const [judge2, setJudge2] = useState<JudgeRound2 | null>(null);
  const [round2, setRound2] = useState<Record<string, Phase>>({});
  // The Judge's bubble while it checks whether the cards are enough; the Scout's on its second trip.
  const [checking, setChecking] = useState(false);
  const [scoutLook, setScoutLook] = useState<string | null>(null);
  // Set while the Judge asks for a better search: the Judge's bubble and the caption.
  const [rewriting, setRewriting] = useState<string | null>(null);
  // Set while the Judge says that nothing on file touches the question.
  const [noFile, setNoFile] = useState(false);
  const [privateSent, setPrivateSent] = useState(0);
  const [asked, setAsked] = useState(false);
  const [overlay, setOverlay] = useState<MapOverlay>({});
  const [sentPrompt, setSentPrompt] = useState<string | null>(null);
  const about = useAbout();
  const [library, setLibrary] = useState<LibraryDocument[] | null>(null);
  /** "part 3 of 12": where a card sits in its document (just "part 3" until the library loads). */
  const partOf: PartOf = (r) => {
    const total =
      r.source === "library"
        ? library?.find((d) => d.id === r.document_id)?.chunk_count
        : texts.find((t) => t.title === r.title)?.chunks.length;
    return total ? `part ${r.position + 1} of ${total}` : `part ${r.position + 1}`;
  };

  const privateChunks = texts
    .flatMap((item) =>
      item.chunks.map((chunk, i) => ({
        title: item.title,
        position: chunk.position,
        heading: chunk.heading,
        ...(chunk.page != null ? { page: chunk.page } : {}),
        text: chunk.text,
        vector: item.vectors[i],
      })),
    )
    .slice(0, MAX_PRIVATE_CHUNKS);

  /** Where to read the cited passage in full: a library document, or the visitor's own text. */
  function targetFor(c: Citation): ViewTarget | null {
    if (c.source === "library") {
      return c.document_id === null
        ? null
        : { kind: "library", id: c.document_id, chunk: c.position };
    }
    const index = texts.findIndex((item) => item.title === c.title);
    return index === -1 ? null : { kind: "private", index, chunk: c.position };
  }

  function openViewer(target: ViewTarget) {
    setViewer(target);
    document.getElementById("library")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fail(message: string) {
    setError(message);
    queue.emit({ name: "error" });
    // Whatever was running when it failed shows as failed.
    setStates((now) => sceneReducer(now, { step: "error", status: "done" }));
    setShown((now) => sceneReducer(now, { step: "error", status: "done" }));
    setAnimating(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (animating) {
      queue.skipAll();
      setAnimating(false);
    }
    setRun((n) => n + 1);
    setTab("answer");
    setBusy(true);
    setAnimating(true);
    setAsked(true);
    setAskedQuestion(question.trim());
    setError("");
    setAnswer("");
    setAnswerModel(null);
    setRevealed(!onRef.current);
    setCitations([]);
    setStates({});
    setShown({});
    setWords([]);
    setScout(null);
    setJudge(null);
    setLook(null);
    setLookComing(false);
    setLookPlayed(!onRef.current);
    setTranslator2(null);
    setScout2(null);
    setJudge2(null);
    setRound2({});
    setChecking(false);
    setScoutLook(null);
    setRewriting(null);
    setNoFile(false);
    setOverlay({});
    setPrivateSent(privateChunks.length);
    setSentPrompt(null);
    if (!onRef.current) {
      answerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    queue.clear();
    const runStart = performance.now();
    let streamEnd = 0;
    queue.emit({ name: "question_start" });
    // Each step starts once per round, so a second start is round 2; `followUp` is its query.
    const starts: Record<string, number> = {};
    let followUp = "";
    try {
      const response = await fetch(`${backendUrl()}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, private_chunks: privateChunks }),
      });
      if (!response.ok) {
        fail(`Question rejected (${response.status})`);
        return;
      }
      for await (const e of readEvents(response)) {
        if ("delta" in e) {
          setAnswer((text) => text + e.delta);
          continue;
        }
        setStates((now) => sceneReducer(now, e));
        const update = () => setShown((now) => sceneReducer(now, e));
        const [sceneEvent] = toSceneEvents(e);
        if (e.status === "start") starts[e.step] = (starts[e.step] ?? 0) + 1;
        const second = e.status === "start" && starts[e.step] > 1;
        if (e.step === "error") {
          setError(String(e.data?.message ?? "Something went wrong"));
          queue.emit({ name: "error" });
          update();
          setAnimating(false);
        } else if (e.step === "second_look") {
          const query = typeof e.data?.query === "string" && e.data.query ? e.data.query : null;
          if (query) followUp = query;
          if (e.status === "done" && e.data?.round === 2) {
            // The final check after the second round: the Judge's second page shows it.
            const part = typeof e.data?.part === "number" ? e.data.part : null;
            const nothing = e.data?.nothing === true;
            setJudge2((now) => (now ? { ...now, check: { part, nothing } } : now));
          } else if (e.status === "done") {
            setLook({
              query,
              enough: typeof e.data?.enough === "number" ? e.data.enough : null,
              relevant: typeof e.data?.relevant === "number" ? e.data.relevant : null,
              nothing: e.data?.nothing === true,
              decidedBy: e.data?.decided_by === "decider" ? "decider" : "llm",
            });
          }
          queue.emit(sceneEvent, {
            onStart: () => {
              if (e.status === "done") setLookPlayed(true);
              if (query && e.status === "done") setRewriting(query);
              if (e.data?.nothing === true) setNoFile(true);
            },
            onEnd: () => {
              update();
              setRewriting(null);
              setNoFile(false);
              setChecking(e.status === "start");
            },
          });
        } else if (e.status === "start") {
          // The message isn't visible progress, so it shows up right away.
          if (e.step === "storyteller" && typeof e.data?.prompt === "string") {
            setSentPrompt(e.data.prompt);
          }
          if (second) setRound2((now) => ({ ...now, [e.step]: "working" }));
          queue.emit(sceneEvent, {
            onStart: () => {
              update();
              if (e.step === "storyteller") setRevealed(true);
              if (second) {
                // Only now, after the follow-up's fingerprint, does the Scout set off again.
                if (e.step === "scout") setScoutLook(`Taking a second look: “${followUp}”`);
              }
            },
          });
        } else if (e.step === "translator" && e.data?.round === 2) {
          // The rewritten question: the follow-up's star on the map; the question's words stay.
          const point = e.data?.point as Point | undefined;
          const followUpQuery = typeof e.data?.query === "string" ? e.data.query : followUp;
          setTranslator2({ query: followUpQuery });
          setRound2((now) => ({ ...now, translator: "done" }));
          if (point) {
            setOverlay((now) => ({ ...now, followUp: { point, query: followUpQuery } }));
          }
          queue.emit(sceneEvent, { onEnd: update });
        } else if (e.step === "translator") {
          const found = (e.data?.words ?? []) as Word[];
          const point = e.data?.point as Point | undefined;
          setWords(found);
          if (point) setOverlay((now) => ({ ...now, question: point }));
          queue.emit(sceneEvent, { onEnd: update });
        } else if (e.step === "scout" && e.data?.round === 2) {
          const found = (e.data?.results ?? []) as ScoutResult[];
          setScout2({
            query: typeof e.data?.query === "string" ? e.data.query : followUp,
            skipped: typeof e.data?.skipped === "number" ? e.data.skipped : 0,
            results: found,
          });
          setRound2((now) => ({ ...now, scout: "done" }));
          setOverlay((now) => ({
            ...now,
            followUpCandidates: found.map((r) => ({
              source: r.source,
              document_id: r.document_id,
              title: r.title,
              position: r.position,
              rank: r.rank,
              found_by: r.found_by,
            })),
          }));
          queue.emit(sceneEvent, {
            onEnd: () => {
              update();
              setScoutLook(null);
            },
          });
        } else if (e.step === "judge" && e.data?.round === 2) {
          // The first round's verdict stays on the Judge's tab; this one is its second page.
          const results = (e.data?.results ?? []) as JudgeResult[];
          const finalCards = (e.data?.final_cards ?? []) as FinalCard[];
          setJudge2({
            query: typeof e.data?.query === "string" ? e.data.query : followUp,
            results,
            finalCards,
          });
          setRound2((now) => ({ ...now, judge: "done" }));
          queue.emit(sceneEvent, { onEnd: update });
        } else if (e.step === "scout") {
          const found = (e.data?.results ?? []) as ScoutResult[];
          setScout(found);
          setOverlay((now) => ({
            ...now,
            candidates: found.map((r) => ({
              source: r.source,
              document_id: r.document_id,
              title: r.title,
              position: r.position,
              rank: r.rank,
              found_by: r.found_by,
            })),
          }));
          queue.emit(sceneEvent, { onEnd: update });
        } else if (e.step === "judge") {
          const results = (e.data?.results ?? []) as JudgeResult[];
          setJudge(results);
          setLookComing(e.data?.second_look === true);
          queue.emit(sceneEvent, { onEnd: update });
        } else if (e.step === "storyteller" && e.data) {
          // The final answer has made-up [n] markers removed.
          const final = String(e.data.answer ?? "");
          const sources = (e.data.citations ?? []) as Citation[];
          setAnswer(final);
          setAnswerModel(typeof e.data.model === "string" ? e.data.model : null);
          setQuestion("");
          setCitations(sources);
          // The run's last scene: when it ends the office is done.
          queue.emit(sceneEvent, {
            onEnd: () => {
              update();
              setAnimating(false);
              if (process.env.NODE_ENV === "development") {
                const a = (streamEnd - runStart) / 1000;
                const b = (performance.now() - runStart) / 1000;
                console.log(
                  `[office] stream ${a.toFixed(1)} s, office ${b.toFixed(1)} s, tail ${(b - a).toFixed(1)} s`,
                );
              }
            },
          });
        } else {
          queue.emit(sceneEvent, { onEnd: update });
        }
      }
      streamEnd = performance.now();
    } catch {
      fail("Could not reach the backend");
    } finally {
      setBusy(false);
    }
  }

  const phase = (step: string): Phase => states[step] ?? "waiting";
  const shownPhase = (step: string): Phase => shown[step] ?? "waiting";
  const nothingFound =
    (judge !== null && !judge.some((r) => r.kept)) ||
    look?.nothing === true ||
    judge2?.check?.nothing === true;
  const running = busy;
  const officeBusy = busy || animating;
  const storytellerDone = phase("storyteller") === "done";
  const finished = storytellerDone && !animating;

  const keptCount = judge ? judge.filter((r) => r.kept).length : null;
  // After a second look the Storyteller gets the final cards, not just the first round's.
  const handedCount = judge2 && !judge2.check?.nothing ? judge2.finalCards.length : keptCount;
  const nothingOnFile = look?.nothing === true || judge2?.check?.nothing === true;
  const foundCount = (scout?.length ?? 0) + (scout2?.results.length ?? 0);
  const progress =
    shownPhase("storyteller") === "working"
      ? `The Judge kept ${handedCount ?? 0} of ${foundCount}. The Storyteller is writing…`
      : shownPhase("judge") === "working"
        ? `The Scout found ${scout?.length ?? 0} cards. The Judge is checking them…`
        : shownPhase("scout") === "working"
          ? "The Scout is searching the library…"
          : "The Translator is reading your question…";
  const crewSays: Record<(typeof CREW)[number], string> = {
    translator: askTranslatorSays(),
    scout: scoutLook ?? scoutSays(),
    judge: rewriting
      ? `We need more on: “${rewriting}”`
      : noFile
        ? "Nothing on file about this."
        : checking
        ? "Checking whether that's enough…"
        : judgeSays(scout ? scout.length : null, about?.judge.keep),
    storyteller: storytellerSays(handedCount),
  };
  const caption = error
    ? "Sorry, something went wrong. Try again?"
    : rewriting
      ? `The Judge asked for a better search: “${rewriting}”`
      : finished && nothingFound
        ? "Nothing on file about that. Try something else?"
        : finished
          ? "Here's your answer. The tabs on the right show each step."
          : officeBusy
            ? progress
            : "Ask a question and watch the office find the answer.";
  const crewAt = {
    translator: useFollow(officeRef, "translator", animationsOn && shownPhase("translator") === "working"),
    scout: useFollow(officeRef, "scout", animationsOn && shownPhase("scout") === "working"),
    judge: useFollow(
      officeRef,
      "judge",
      animationsOn && (shownPhase("judge") === "working" || rewriting !== null),
    ),
    storyteller: useFollow(
      officeRef,
      "storyteller",
      animationsOn && shownPhase("storyteller") === "working" && !nothingFound,
    ),
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.hidden}>Ask the library</h1>
      <QuestionBubble
        question={question}
        onChange={setQuestion}
        onSubmit={onSubmit}
        busy={running}
        offline={offline}
        examples={examplesFor(library)}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <div className={styles.grid}>
        <section ref={officeRef} aria-label="The office" className={styles.scene}>
          <button
            type="button"
            className={styles.watch}
            aria-expanded={watching}
            onClick={() => setWatching((on) => !on)}
          >
            {watching ? "▾" : "▸"} Watch the office
          </button>
          <div className={`${styles.room} ${watching ? styles.roomOpen : ""}`}>
            <div className={styles.stage}>
              <OfficeRoom
                src="/office/ask-room.svg"
                label={ASK_LABEL}
                build={buildAskScenes}
                queue={queue}
              />
              {library !== null && (
                <span
                  className={styles.count}
                  style={{ left: `${ASK_DOC_COUNT.left}%`, top: `${ASK_DOC_COUNT.top}%` }}
                  aria-hidden="true"
                >
                  {library.length + texts.length}
                </span>
              )}
            </div>
          </div>
          <div className={styles.bubbles}>
            {CREW.map((step) => {
              const at = crewAt[step];
              return at && <SpeechBubble key={step} name={NAMES[step]} text={crewSays[step]} at={at} />;
            })}
          </div>
          <div className={styles.caption}>
            <p aria-live="polite" className="visually-hidden">
              {caption}
            </p>
            <AnimationToggle on={animationsOn} onChange={setAnimationsOn} />
          </div>
        </section>

        <div ref={answerRef} className={styles.side}>
          <StepDetails
            tab={tab}
            onTab={setTab}
            states={states}
            played={animationsOn ? shown : states}
            lookComing={lookComing}
            partOf={partOf}
            answer={
              <AnswerCard
                answer={revealed ? answer : ""}
                citations={revealed ? citations : []}
                askedQuestion={askedQuestion}
                model={answerModel}
                started={phase("translator") !== "waiting"}
                progress={progress}
                cardsFound={foundCount}
                kept={nothingOnFile ? 0 : handedCount ?? 0}
                targetFor={targetFor}
                onOpen={openViewer}
                partOf={partOf}
              />
            }
            revealed={revealed}
            answerText={answer}
            citations={citations}
            words={words}
            scout={scout}
            look={lookPlayed ? look : null}
            translator2={lookPlayed ? translator2 : null}
            scout2={lookPlayed ? scout2 : null}
            judge2={lookPlayed ? judge2 : null}
            round2={lookPlayed ? round2 : {}}
            judge={judge}
            follow={animationsOn}
            overlay={overlay}
            privateSent={privateSent}
            sentPrompt={sentPrompt}
            run={run}
          />
        </div>
      </div>

      <section className={styles.library} aria-labelledby="library-h">
        <h2 id="library-h">Browse the library</h2>
        <LibraryPanel onLoad={setLibrary} onOpen={openViewer} viewer={viewer} overlay={overlay} />
      </section>
    </div>
  );
}
