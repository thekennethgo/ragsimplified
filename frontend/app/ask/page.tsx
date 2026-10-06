"use client";

import { type FormEvent, useState } from "react";

import { AnswerBubble } from "../../components/ask/AnswerBubble";
import { CharacterRow, type SceneState } from "../../components/ask/CharacterRow";
import { QuestionBubble } from "../../components/ask/QuestionBubble";
import { SourcesSidebar } from "../../components/ask/SourcesSidebar";
import { type Citation, type StepState, type Word } from "../../lib/ask";
import { backendUrl, readEvents } from "../../lib/backend";
import { usePrivateTexts } from "../../lib/PrivateTexts";

// The backend accepts at most this many private chunks per question.
const MAX_PRIVATE_CHUNKS = 60;

type Steps = Partial<Record<string, StepState>>;
type Candidate = { kept?: boolean };

export default function AskPage() {
  const { texts } = usePrivateTexts();
  const [question, setQuestion] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Steps>({});
  const [words, setWords] = useState<Word[]>([]);
  const [scoutDetail, setScoutDetail] = useState<string | undefined>();
  const [judgeDetail, setJudgeDetail] = useState<string | undefined>();

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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLog([]);
    setAnswer("");
    setCitations([]);
    setSelected(null);
    setSidebarOpen(false);
    setSteps({});
    setWords([]);
    setScoutDetail(undefined);
    setJudgeDetail(undefined);
    try {
      const response = await fetch(`${backendUrl()}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, private_chunks: privateChunks }),
      });
      if (!response.ok) {
        setLog([`Question rejected (${response.status})`]);
        return;
      }
      for await (const e of readEvents(response)) {
        if ("delta" in e) {
          setAnswer((text) => text + e.delta);
          continue;
        }
        setLog((lines) => [...lines, `${e.step}: ${e.status}`]);
        if (e.step === "error") {
          setLog((lines) => [...lines, String(e.data?.message ?? "Something went wrong")]);
          // Whatever was running when it failed shows as failed.
          setSteps((now) =>
            Object.fromEntries(
              Object.entries(now).map(([step, state]) => [
                step,
                state === "working" ? "error" : state,
              ]),
            ),
          );
          continue;
        }
        setSteps((now) => ({ ...now, [e.step]: e.status === "start" ? "working" : "done" }));
        if (e.step === "translator" && e.status === "done") {
          setWords((e.data?.words ?? []) as Word[]);
        } else if (e.step === "scout" && e.status === "done") {
          const found = (e.data?.results ?? []) as unknown[];
          setScoutDetail(`${found.length} candidates`);
        } else if (e.step === "judge" && e.status === "done") {
          const results = (e.data?.results ?? []) as Candidate[];
          const kept = results.filter((r) => r.kept).length;
          setJudgeDetail(`kept ${kept} of ${results.length}${e.data?.fallback ? " (fallback)" : ""}`);
        } else if (e.step === "storyteller" && e.status === "done" && e.data) {
          // The final answer has made-up [n] markers removed.
          setAnswer(String(e.data.answer ?? ""));
          setCitations((e.data.citations ?? []) as Citation[]);
        }
      }
    } catch {
      setLog((lines) => [...lines, "Could not reach the backend"]);
    } finally {
      setBusy(false);
    }
  }

  const stateOf = (step: string): StepState => steps[step] ?? "waiting";
  const scene: SceneState = {
    translator: stateOf("translator"),
    scout: stateOf("scout"),
    judge: stateOf("judge"),
    storyteller: stateOf("storyteller"),
    scoutDetail,
    judgeDetail,
  };

  return (
    <>
      <h1>Ask</h1>
      <p>
        Questions search the starter library
        {texts.length > 0 ? ` and your ${texts.length} pasted text(s)` : ""}. Your question and the
        passages found are sent to Voyage and to the language model provider.
      </p>
      {totalPrivateChunks > MAX_PRIVATE_CHUNKS && (
        <p>
          Only the first {MAX_PRIVATE_CHUNKS} of your {totalPrivateChunks} chunks are searched.
        </p>
      )}

      <CharacterRow
        state={scene}
        above={{
          translator: (
            <QuestionBubble
              question={question}
              onChange={setQuestion}
              onSubmit={onSubmit}
              busy={busy}
              words={words}
            />
          ),
          storyteller: (
            <AnswerBubble
              answer={answer}
              citations={citations}
              onOpenSource={openSource}
              onShowSources={() => setSidebarOpen(true)}
            />
          ),
        }}
      />

      <section aria-label="Progress">
        <h2>Progress</h2>
        <pre>{log.join("\n")}</pre>
      </section>

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
