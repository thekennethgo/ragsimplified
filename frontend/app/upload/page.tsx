"use client";

import { useState } from "react";

import LibraryPanel from "../../components/LibraryPanel";
import OfficeRoom from "../../components/office/OfficeRoom";
import SpeechBubble from "../../components/office/SpeechBubble";
import EnvelopeForm from "../../components/upload/EnvelopeForm";
import WhatHappened, { type ChunkDetail } from "../../components/upload/WhatHappened";
import { backendUrl, readEvents } from "../../lib/backend";
import { UPLOAD_BUBBLES, UPLOAD_DOC_COUNT } from "../../lib/office-spots";
import { buildUploadScenes } from "../../lib/office/scenes/upload";
import { useSceneQueue } from "../../lib/office/useSceneQueue";
import { type PrivateText, usePrivateTexts } from "../../lib/PrivateTexts";
import { type Phase, sceneReducer, toSceneEvents } from "../../lib/sceneState";
import styles from "./page.module.css";

const ROOM_LABEL = "The Upload office: the Chopper, the Translator and the Archivist at work.";

export default function UploadPage() {
  const queue = useSceneQueue();
  // Private texts live only in the browser's memory (ADR 002): nothing is stored server-side.
  const { texts, add } = usePrivateTexts();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [states, setStates] = useState<Record<string, Phase>>({});
  const [title, setTitle] = useState("");
  const [chunkCount, setChunkCount] = useState<number | null>(null);
  const [chunkDetails, setChunkDetails] = useState<ChunkDetail[] | null>(null);
  const [vectors, setVectors] = useState<number[][] | null>(null);
  const [starterBooks, setStarterBooks] = useState<number | null>(null);

  const phase = (step: string): Phase => states[step] ?? "waiting";
  const cards =
    chunkCount === null ? "your cards" : `${chunkCount} ${chunkCount === 1 ? "card" : "cards"}`;
  const says = {
    chopper: {
      waiting: "Inbox empty. I'll cut your text into cards.",
      working: `Cutting "${title}" into cards.`,
      done: `Cut into ${cards}.`,
      error: "Sorry, I could not cut that.",
    },
    translator: {
      waiting: "I'll give each card a fingerprint.",
      working: `Fingerprinting ${cards}.`,
      done: `All ${cards} fingerprinted.`,
      error: "Sorry, I could not fingerprint that.",
    },
    archivist: {
      waiting: "I'll file it in the cabinet.",
      working: "Filing it with your books.",
      done: "Filed with your books, in this tab only.",
      error: "Sorry, I could not file that.",
    },
  };

  /** Move a step's phase and (for the Archivist, which has no backend step) the scene along. */
  function archivist(status: "start" | "done") {
    setStates((now) => sceneReducer(now, { step: "archivist", status }));
    queue.emit({ name: `archivist_${status}` });
  }

  async function onSubmit(newTitle: string, text: string): Promise<boolean> {
    setBusy(true);
    setError("");
    setStates({});
    setTitle(newTitle);
    setChunkCount(null);
    setChunkDetails(null);
    setVectors(null);
    queue.clear();
    let added = false;
    try {
      const response = await fetch(`${backendUrl()}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, text }),
      });
      if (!response.ok) {
        setError(`Upload rejected (${response.status})`);
        return false;
      }
      for await (const e of readEvents(response)) {
        if (!("status" in e)) continue;
        setStates((now) => sceneReducer(now, e));
        toSceneEvents(e).forEach((event) => queue.emit(event));
        if (e.step === "error") {
          setError(String(e.data?.message ?? "Upload failed"));
        } else if (e.step === "chopper" && e.status === "done") {
          setChunkCount(Number(e.data?.chunks ?? 0));
          setChunkDetails((e.data?.chunk_details ?? null) as ChunkDetail[] | null);
        } else if (e.step === "translator" && e.status === "done" && e.data) {
          const { chunks, vectors: made } = e.data as Pick<PrivateText, "chunks" | "vectors">;
          setVectors(made);
          archivist("start");
          add({ title: newTitle, text, chunks, vectors: made });
          archivist("done");
          added = true;
        }
      }
    } catch {
      setError("Could not reach the backend");
      setStates((now) => sceneReducer(now, { step: "error", status: "done" }));
      queue.emit({ name: "error" });
    } finally {
      setBusy(false);
    }
    return added;
  }

  const documents = starterBooks === null ? null : starterBooks + texts.length;

  return (
    <>
      <section aria-labelledby="office-h" className={styles.office}>
        <h1 id="office-h" className={styles.title}>
          The office
        </h1>
        <div className={styles.stage}>
          <OfficeRoom
            src="/office/upload-room.svg"
            label={ROOM_LABEL}
            build={buildUploadScenes}
            queue={queue}
          />
          {documents !== null && (
            <span
              className={styles.count}
              style={{ left: `${UPLOAD_DOC_COUNT.left}%`, top: `${UPLOAD_DOC_COUNT.top}%` }}
              aria-hidden="true"
            >
              {documents}
            </span>
          )}
        </div>
        <div className={styles.bubbles}>
          <SpeechBubble
            name="Chopper"
            phase={phase("chopper")}
            text={says.chopper[phase("chopper")]}
            anchor={UPLOAD_BUBBLES.chopper}
          />
          <SpeechBubble
            name="Translator"
            phase={phase("translator")}
            text={says.translator[phase("translator")]}
            anchor={UPLOAD_BUBBLES.translator}
          />
          <SpeechBubble
            name="Archivist"
            phase={phase("archivist")}
            text={says.archivist[phase("archivist")]}
            anchor={UPLOAD_BUBBLES.archivist}
          />
        </div>
      </section>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <div className={styles.row}>
        <EnvelopeForm onSubmit={onSubmit} busy={busy} />
        <WhatHappened states={states} chunks={chunkDetails} vectors={vectors} />
      </div>

      <LibraryPanel onCount={setStarterBooks} />
    </>
  );
}
