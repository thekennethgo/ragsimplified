"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useRef, useState } from "react";

import AnswerPanel from "../../components/ask/AnswerPanel";
import { QuestionBubble } from "../../components/ask/QuestionBubble";
import LibraryPanel from "../../components/LibraryPanel";
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
import { type Citation, type JudgeResult, type ScoutResult, type Word } from "../../lib/ask";
import { backendUrl, readEvents } from "../../lib/backend";
import type { MapOverlay, Point } from "../../lib/map";
import { useAnimationsSetting } from "../../lib/office/animationSetting";
import { buildAskScenes } from "../../lib/office/scenes/ask";
import { buildQueryScenes } from "../../lib/office/scenes/query";
import { useFollow } from "../../lib/office/useFollow";
import { useSceneQueue } from "../../lib/office/useSceneQueue";
import { useBackendHealth } from "../../lib/health";
import { usePrivateTexts } from "../../lib/PrivateTexts";
import { type Phase, sceneReducer, toSceneEvents } from "../../lib/sceneState";
import type { ViewTarget } from "../../lib/viewer";
import styles from "./page.module.css";

// The backend accepts at most this many private chunks per question.
const MAX_PRIVATE_CHUNKS = 60;

const ASK_LABEL = "The Ask office: the Clerk, Translator, Scout, Judge and Storyteller at work.";
const QUERY_LABEL = "The Query room, where the Clerk takes your question.";

const EXAMPLES = [
  "What is retrieval-augmented generation?",
  "Who founded Apple and in what year?",
  "What is Apple silicon and which Macs first used it?",
  "What does TREC stand for and when was it started?",
];

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
    if (!animationsOn) queue.skipAll();
  }, [animationsOn, queue]);
  const officeRef = useRef<HTMLElement>(null);
  // With the office on, the streamed answer waits here until the Clerk is back.
  const pending = useRef("");
  const answerRef = useRef<HTMLDivElement>(null);
  const { texts } = usePrivateTexts();
  // /ask?q=... opens with the question filled in (the Home page's "Ask the office about me").
  const prefilled = useSearchParams().get("q") ?? "";
  const [question, setQuestion] = useState(prefilled);
  const offline = useBackendHealth() === "offline";
  const [askedQuestion, setAskedQuestion] = useState("");
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [viewer, setViewer] = useState<ViewTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [states, setStates] = useState<Record<string, Phase>>({});
  const [words, setWords] = useState<Word[]>([]);
  const [scout, setScout] = useState<ScoutResult[] | null>(null);
  const [judge, setJudge] = useState<JudgeResult[] | null>(null);
  const [asked, setAsked] = useState(false);
  const [overlay, setOverlay] = useState<MapOverlay>({});
  const [privateSent, setPrivateSent] = useState(0);
  const [sentPrompt, setSentPrompt] = useState<string | null>(null);
  const about = useAbout();

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
    setAnimating(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setAnimating(true);
    setAsked(true);
    setAskedQuestion(question.trim());
    setError("");
    setAnswer("");
    setCitations([]);
    setStates({});
    setWords([]);
    setScout(null);
    setJudge(null);
    setOverlay({});
    setPrivateSent(privateChunks.length);
    setSentPrompt(null);
    pending.current = "";
    if (!onRef.current) {
      answerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    queue.clear();
    queue.emit({ name: "clerk_away" });
    queue.emit({ name: "clerk_start" });
    let nothingFound = false;
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
          if (!onRef.current) {
            setAnswer((text) => text + e.delta);
          } else {
            pending.current += e.delta;
          }
          continue;
        }
        const update = () => setStates((now) => sceneReducer(now, e));
        const [sceneEvent] = toSceneEvents(e);
        if (e.step === "error") {
          setError(String(e.data?.message ?? "Something went wrong"));
          queue.emit({ name: "error" });
          update();
          setAnimating(false);
        } else if (e.status === "start") {
          // The message isn't visible progress, so it shows up right away.
          if (e.step === "storyteller" && typeof e.data?.prompt === "string") {
            setSentPrompt(e.data.prompt);
          }
          queue.emit(sceneEvent, { onStart: update });
        } else if (e.step === "translator") {
          const found = (e.data?.words ?? []) as Word[];
          const point = e.data?.point as Point | undefined;
          queue.emit(sceneEvent, {
            onEnd: () => {
              update();
              setWords(found);
              if (point) setOverlay((now) => ({ ...now, question: point }));
            },
          });
        } else if (e.step === "scout") {
          const found = (e.data?.results ?? []) as ScoutResult[];
          queue.emit(sceneEvent, {
            onEnd: () => {
              update();
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
            },
          });
        } else if (e.step === "judge") {
          const results = (e.data?.results ?? []) as JudgeResult[];
          nothingFound = !results.some((r) => r.kept);
          queue.emit(sceneEvent, {
            onEnd: () => {
              update();
              setJudge(results);
            },
          });
        } else if (e.step === "storyteller" && e.data) {
          // The final answer has made-up [n] markers removed.
          const final = String(e.data.answer ?? "");
          const sources = (e.data.citations ?? []) as Citation[];
          queue.emit(sceneEvent, { onEnd: update });
          queue.emit({ name: "clerk_done" });
          queue.emit(
            { name: nothingFound ? "clerk_shrug" : "clerk_back" },
            {
              onEnd: () => {
                setAnswer(final);
                setQuestion("");
                setCitations(sources);
                setAnimating(false);
              },
            },
          );
        } else {
          queue.emit(sceneEvent, { onEnd: update });
        }
      }
    } catch {
      fail("Could not reach the backend");
    } finally {
      setBusy(false);
    }
  }

  const phase = (step: string): Phase => states[step] ?? "waiting";
  const working = CREW.filter((step) => phase(step) === "working");
  const nothingFound = judge !== null && !judge.some((r) => r.kept);
  const running = busy || animating;
  const clerkAway = running && Object.keys(states).length > 0 && phase("storyteller") !== "done";
  const storytellerDone = phase("storyteller") === "done";
  const finished = storytellerDone && !animating;

  const keptCount = judge ? judge.filter((r) => r.kept).length : null;
  const crewSays: Record<(typeof CREW)[number], string> = {
    translator: askTranslatorSays(),
    scout: scoutSays(),
    judge: judgeSays(scout ? scout.length : null, about?.judge.keep),
    storyteller: storytellerSays(keptCount),
  };
  const clerkSays = error
    ? "Sorry, something went wrong. Try again?"
    : finished && nothingFound
      ? "Sorry, nothing on file about that. Try something else?"
      : finished
        ? "Here's your answer. The tabs show who did what."
        : storytellerDone
          ? nothingFound
            ? "Coming back, empty-handed."
            : "Bringing your answer back."
          : clerkAway && working.length === 0
            ? "Passing it to the next desk."
            : clerkAway
              ? `The ${NAMES[working[0]]} is on it. Back soon.`
              : asked && running
                ? "Got it. Pinning it up in the office."
                : "Hi, I'm the Clerk. What do you want to know?";
  const crewAt = {
    translator: useFollow(officeRef, "translator", animationsOn && phase("translator") === "working"),
    scout: useFollow(officeRef, "scout", animationsOn && phase("scout") === "working"),
    judge: useFollow(officeRef, "judge", animationsOn && phase("judge") === "working"),
    storyteller: useFollow(
      officeRef,
      "storyteller",
      animationsOn && phase("storyteller") === "working",
    ),
  };
  const clerkAt = useFollow(officeRef, "clerk", animationsOn && clerkAway);
  const clerkHere = !asked || !running;

  return (
    <>
      <section ref={officeRef} aria-labelledby="office-h" className={styles.office}>
        <h1 id="office-h" className={styles.title}>
          The office
        </h1>
        <AnimationToggle on={animationsOn} onChange={setAnimationsOn} />
        <div className={styles.stage}>
          <OfficeRoom
            src="/office/ask-room.svg"
            label={ASK_LABEL}
            build={buildAskScenes}
            queue={queue}
          />
        </div>
        <div className={styles.bubbles}>
          {CREW.map((step) => {
            const at = crewAt[step];
            return at && <SpeechBubble key={step} name={NAMES[step]} text={crewSays[step]} at={at} />;
          })}
          {clerkAt && (
            <div
              className={`bubble ${styles.clerkWaits}`}
              aria-label="The Clerk is waiting for a reply"
              role="img"
              style={{
                left: `${clerkAt.left}px`,
                top: `${clerkAt.top}px`,
                transform: "translate(-50%, calc(-100% - 10px))",
              }}
            >
              <span />
              <span />
              <span />
              <span className="tail" style={{ left: "50%" }} />
            </div>
          )}
        </div>
      </section>

      <div className={styles.row}>
        <section aria-labelledby="ask-h" className={`panel ${styles.query}`}>
          <h2 id="ask-h">Query</h2>
          <div className={styles.queryRoom}>
            <OfficeRoom
              src="/office/query-room.svg"
              label={QUERY_LABEL}
              build={buildQueryScenes}
              queue={queue}
            />
            <div className={styles.clerkSays}>
              <span className={styles.arrow} />
              <p>{clerkHere ? "Clerk" : "Note from the Clerk"}</p>
              <p aria-live="polite">{clerkSays}</p>
            </div>
          </div>
          <QuestionBubble
            question={question}
            onChange={setQuestion}
            onSubmit={onSubmit}
            busy={running}
            offline={offline}
            examples={EXAMPLES}
          />
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </section>

        <div ref={answerRef} style={{ flex: "999 1 620px", minWidth: 0 }}>
          <AnswerPanel
            states={states}
            answer={answer}
            citations={citations}
            words={words}
            scout={scout}
            judge={judge}
            askedQuestion={askedQuestion}
            targetFor={targetFor}
            onOpenInViewer={openViewer}
            follow={animationsOn}
            overlay={overlay}
            privateSent={privateSent}
            sentPrompt={sentPrompt}
          />
        </div>
      </div>

      <LibraryPanel onOpen={openViewer} viewer={viewer} overlay={overlay} />
    </>
  );
}
