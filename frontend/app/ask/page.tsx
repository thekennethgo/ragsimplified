"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";

import AnswerPanel from "../../components/ask/AnswerPanel";
import { QuestionBubble } from "../../components/ask/QuestionBubble";
import { SourcesSidebar } from "../../components/ask/SourcesSidebar";
import LibraryPanel from "../../components/LibraryPanel";
import OfficeRoom from "../../components/office/OfficeRoom";
import SpeechBubble from "../../components/office/SpeechBubble";
import { type Citation, type JudgeResult, type ScoutResult, type Word } from "../../lib/ask";
import { backendUrl, readEvents } from "../../lib/backend";
import { ASK_BUBBLES } from "../../lib/office-spots";
import { buildAskScenes } from "../../lib/office/scenes/ask";
import { buildQueryScenes } from "../../lib/office/scenes/query";
import { useSceneQueue } from "../../lib/office/useSceneQueue";
import { usePrivateTexts } from "../../lib/PrivateTexts";
import { type Phase, sceneReducer, toSceneEvents } from "../../lib/sceneState";
import styles from "./page.module.css";

// The backend accepts at most this many private chunks per question.
const MAX_PRIVATE_CHUNKS = 60;

const ASK_LABEL = "The Ask office: the Clerk, Translator, Scout, Judge and Storyteller at work.";
const QUERY_LABEL = "The Query room, where the Clerk takes your question.";

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
  const queue = useSceneQueue();
  const { texts } = usePrivateTexts();
  // /ask?q=... opens with the question filled in (the Home page's "Ask the office about me").
  const prefilled = useSearchParams().get("q") ?? "";
  const [question, setQuestion] = useState(prefilled);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [states, setStates] = useState<Record<string, Phase>>({});
  const [words, setWords] = useState<Word[]>([]);
  const [scout, setScout] = useState<ScoutResult[] | null>(null);
  const [judge, setJudge] = useState<JudgeResult[] | null>(null);
  const [asked, setAsked] = useState(false);

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
  const totalPrivateChunks = texts.reduce((sum, item) => sum + item.chunks.length, 0);

  /** Where to read the cited passage in full: a library document, or the visitor's own text. */
  function sourceHref(c: Citation): string | null {
    if (c.source === "library") {
      return c.document_id === null ? null : `/library/${c.document_id}?chunk=${c.position}`;
    }
    const index = texts.findIndex((item) => item.title === c.title);
    return index === -1 ? null : `/texts/${index}?chunk=${c.position}`;
  }

  function openSource(n: number) {
    setSelected(n);
    setSidebarOpen(true);
  }

  function fail(message: string) {
    setError(message);
    // Whatever was running when it failed shows as failed.
    setStates((now) => sceneReducer(now, { step: "error", status: "done" }));
    queue.emit({ name: "error" });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setAsked(true);
    setError("");
    setAnswer("");
    setCitations([]);
    setSelected(null);
    setSidebarOpen(false);
    setStates({});
    setWords([]);
    setScout(null);
    setJudge(null);
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
          setAnswer((text) => text + e.delta);
          continue;
        }
        setStates((now) => sceneReducer(now, e));
        toSceneEvents(e).forEach((sceneEvent) => queue.emit(sceneEvent));
        if (e.step === "error") {
          setError(String(e.data?.message ?? "Something went wrong"));
          continue;
        }
        if (e.step === "translator" && e.status === "done") {
          setWords((e.data?.words ?? []) as Word[]);
        } else if (e.step === "scout" && e.status === "done") {
          setScout((e.data?.results ?? []) as ScoutResult[]);
        } else if (e.step === "judge" && e.status === "done") {
          const results = (e.data?.results ?? []) as JudgeResult[];
          setJudge(results);
          nothingFound = !results.some((r) => r.kept);
        } else if (e.step === "storyteller" && e.status === "done" && e.data) {
          // The final answer has made-up [n] markers removed.
          setAnswer(String(e.data.answer ?? ""));
          setCitations((e.data.citations ?? []) as Citation[]);
          queue.emit({ name: "clerk_done" });
          queue.emit({ name: nothingFound ? "clerk_shrug" : "clerk_back" });
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
  const clerkAway = busy && Object.keys(states).length > 0 && phase("storyteller") !== "done";
  const finished = phase("storyteller") === "done";

  const crewSays: Record<(typeof CREW)[number], string> = {
    translator: "Fingerprinting your question.",
    scout: "Searching by meaning and by words.",
    judge: scout
      ? `Keeping the best of ${scout.length} cards.`
      : "Reading the cards next to your question.",
    storyteller: judge
      ? `Writing from those ${judge.filter((r) => r.kept).length}, citing each one.`
      : "Writing the answer, citing each card.",
  };
  const clerkSays = error
    ? "Sorry, something went wrong. Try again?"
    : finished && nothingFound
      ? "Sorry, nothing on file about that. Try something else?"
      : finished
        ? "Here's your answer. The tabs show who did what."
        : clerkAway
          ? `The ${NAMES[working[0] ?? "translator"]} is on it. Back soon.`
          : asked && busy
            ? "Got it. Pinning it up in the office."
            : "Hi, I'm the Clerk. What do you want to know?";
  const clerkHere = !asked || !busy;

  return (
    <>
      <p className={styles.intro}>
        Questions search the starter library
        {texts.length > 0 ? ` and your ${texts.length} pasted text(s)` : ""}. Your question and the
        passages found are sent to Voyage and to the language model provider.
        {totalPrivateChunks > MAX_PRIVATE_CHUNKS &&
          ` Only the first ${MAX_PRIVATE_CHUNKS} of your ${totalPrivateChunks} chunks are searched.`}
      </p>

      <section aria-labelledby="office-h" className={styles.office}>
        <h1 id="office-h" className={styles.title}>
          The office
        </h1>
        <div className={styles.stage}>
          <OfficeRoom
            src="/office/ask-room.svg"
            label={ASK_LABEL}
            build={buildAskScenes}
            queue={queue}
          />
        </div>
        <div className={styles.bubbles}>
          {working.map((step) => (
            <SpeechBubble
              key={step}
              name={NAMES[step]}
              phase="working"
              text={crewSays[step]}
              anchor={ASK_BUBBLES[step]}
              width={12.5}
            />
          ))}
          {clerkAway && (
            <div
              className={`bubble ${styles.clerkWaits}`}
              aria-label="The Clerk is waiting for a reply"
              role="img"
              style={{ left: `${ASK_BUBBLES.clerk.left}%`, bottom: `${ASK_BUBBLES.clerk.bottom}%` }}
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
            busy={busy}
          />
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </section>

        <AnswerPanel
          states={states}
          answer={answer}
          citations={citations}
          words={words}
          scout={scout}
          judge={judge}
          nothingFound={nothingFound}
          hrefFor={sourceHref}
          onOpenSource={openSource}
          onShowSources={() => setSidebarOpen(true)}
        />
      </div>

      <LibraryPanel />

      {sidebarOpen && (
        <SourcesSidebar
          citations={citations}
          selected={selected}
          hrefFor={sourceHref}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}
