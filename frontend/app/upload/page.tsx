"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import LibraryPanel from "../../components/LibraryPanel";
import Toast from "../../components/Toast";
import AnimationToggle from "../../components/office/AnimationToggle";
import OfficeRoom from "../../components/office/OfficeRoom";
import SpeechBubble from "../../components/office/SpeechBubble";
import EnvelopeForm from "../../components/upload/EnvelopeForm";
import WhatHappened, { type ChunkDetail } from "../../components/upload/WhatHappened";
import { backendUrl, readEvents } from "../../lib/backend";
import { archivistSays, chopperSays, uploadTranslatorSays } from "../../lib/characters";
import { useBackendHealth } from "../../lib/health";
import { useAnimationsSetting } from "../../lib/office/animationSetting";
import { UPLOAD_DOC_COUNT } from "../../lib/office-spots";
import { buildUploadScenes } from "../../lib/office/scenes/upload";
import { useFollow } from "../../lib/office/useFollow";
import { useSceneQueue } from "../../lib/office/useSceneQueue";
import { type PrivateText, usePrivateTexts } from "../../lib/PrivateTexts";
import { type Phase, sceneReducer, toSceneEvents } from "../../lib/sceneState";
import type { ViewTarget } from "../../lib/viewer";
import styles from "./page.module.css";

const ROOM_LABEL = "The Upload office: the Chopper, the Translator and the Archivist at work.";

export default function UploadPage() {
  const [animationsOn, setAnimationsOn] = useAnimationsSetting();
  const onRef = useRef(animationsOn);
  onRef.current = animationsOn;
  const queue = useSceneQueue(() => !onRef.current);
  useEffect(() => {
    if (!animationsOn) queue.skipAll();
  }, [animationsOn, queue]);
  const officeRef = useRef<HTMLElement>(null);
  // Private texts live only in the browser's memory (ADR 002): nothing is stored server-side.
  const { texts, add } = usePrivateTexts();
  const offline = useBackendHealth() === "offline";
  const [busy, setBusy] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [error, setError] = useState("");
  const [states, setStates] = useState<Record<string, Phase>>({});
  const [title, setTitle] = useState("");
  const [chunkCount, setChunkCount] = useState<number | null>(null);
  const [chunkDetails, setChunkDetails] = useState<ChunkDetail[] | null>(null);
  const [vectors, setVectors] = useState<number[][] | null>(null);
  const [toast, setToast] = useState<{ message: string; index: number } | null>(null);
  const [viewer, setViewer] = useState<ViewTarget | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const [starterBooks, setStarterBooks] = useState<number | null>(null);

  const phase = (step: string): Phase => states[step] ?? "waiting";
  const says = {
    chopper: chopperSays(title),
    translator: uploadTranslatorSays(chunkCount),
    archivist: archivistSays(chunkCount),
  };

  /** Move the Archivist's phase and scene along (it has no backend step). */
  function archivist(status: "start" | "done", title?: string, cardCount?: number, index = 0) {
    const update = () => setStates((now) => sceneReducer(now, { step: "archivist", status }));
    if (status === "start") {
      queue.emit({ name: "archivist_start" }, { onStart: update });
    } else {
      queue.emit(
        { name: "archivist_done" },
        {
          onEnd: () => {
            update();
            setAnimating(false);
            setToast({
              message: `"${title}" is in your folder: ${cardCount} ${cardCount === 1 ? "card" : "cards"}. Only this tab can see it.`,
              index,
            });
          },
        },
      );
    }
  }

  async function onSubmit(newTitle: string, text: string): Promise<boolean> {
    setBusy(true);
    setAnimating(true);
    setError("");
    setStates({});
    setTitle(newTitle);
    setChunkCount(null);
    setChunkDetails(null);
    setVectors(null);
    setToast(null);
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
        setAnimating(false);
        return false;
      }
      for await (const e of readEvents(response)) {
        if (!("status" in e)) continue;
        const [sceneEvent] = toSceneEvents(e);
        const update = () => setStates((now) => sceneReducer(now, e));
        if (e.step === "error") {
          setError(String(e.data?.message ?? "Upload failed"));
          queue.emit({ name: "error" });
          update();
          setAnimating(false);
        } else if (e.step === "chopper" && e.status === "done") {
          queue.emit(sceneEvent, {
            onEnd: () => {
              update();
              setChunkCount(Number(e.data?.chunks ?? 0));
              setChunkDetails((e.data?.chunk_details ?? null) as ChunkDetail[] | null);
            },
          });
        } else if (e.step === "translator" && e.status === "done" && e.data) {
          const {
            chunks,
            vectors: made,
            points,
          } = e.data as Pick<PrivateText, "chunks" | "vectors" | "points">;
          queue.emit(sceneEvent, {
            onEnd: () => {
              update();
              setVectors(made);
            },
          });
          archivist("start");
          const index = texts.length;
          add({ title: newTitle, text, chunks, vectors: made, points });
          archivist("done", newTitle, chunks.length, index);
          added = true;
        } else {
          queue.emit(sceneEvent, e.status === "start" ? { onStart: update } : { onEnd: update });
        }
      }
    } catch {
      setError("Could not reach the backend");
      queue.emit({ name: "error" });
      setStates((now) => sceneReducer(now, { step: "error", status: "done" }));
      setAnimating(false);
    } finally {
      setBusy(false);
    }
    return added;
  }

  const chopperAt = useFollow(officeRef, "chopper", animationsOn && phase("chopper") === "working");
  const translatorAt = useFollow(
    officeRef,
    "translator",
    animationsOn && phase("translator") === "working",
  );
  const archivistAt = useFollow(
    officeRef,
    "archivist",
    animationsOn && phase("archivist") === "working",
  );
  function openViewer(target: ViewTarget) {
    setViewer(target);
    document.getElementById("library")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const documents = starterBooks === null ? null : starterBooks + texts.length;

  return (
    <>
      <section ref={officeRef} aria-labelledby="office-h" className={styles.office}>
        <h1 id="office-h" className={styles.title}>
          The office
        </h1>
        <AnimationToggle on={animationsOn} onChange={setAnimationsOn} />
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
              style={{
                left: `${UPLOAD_DOC_COUNT.left}%`,
                top: `${UPLOAD_DOC_COUNT.top}%`,
              }}
              aria-hidden="true"
            >
              {documents}
            </span>
          )}
        </div>
        <div className={styles.bubbles}>
          {chopperAt && <SpeechBubble name="Chopper" text={says.chopper} at={chopperAt} />}
          {translatorAt && (
            <SpeechBubble name="Translator" text={says.translator} at={translatorAt} />
          )}
          {archivistAt && <SpeechBubble name="Archivist" text={says.archivist} at={archivistAt} />}
        </div>
      </section>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <div className={styles.row}>
        <EnvelopeForm onSubmit={onSubmit} busy={busy || animating} offline={offline} />
        <WhatHappened states={states} chunks={chunkDetails} vectors={vectors} />
      </div>

      <LibraryPanel onCount={setStarterBooks} onOpen={openViewer} viewer={viewer} />

      {toast && (
        <Toast
          message={toast.message}
          action={{
            label: "Open it in the viewer",
            onClick: () => {
              setToast(null);
              openViewer({ kind: "private", index: toast.index, chunk: null });
            },
          }}
          onClose={closeToast}
        />
      )}
    </>
  );
}
