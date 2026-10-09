import type { SceneEvent, SceneSet, Timeline } from "./types";

export type SceneQueue = {
  register(set: SceneSet): () => void;
  emit(event: SceneEvent): void;
  clear(): void;
};

/** `chopper_start` belongs to the chopper: its next scene ends its "still working" loop. */
const who = (name: string) => name.split("_")[0];

/**
 * Plays scenes one at a time, in order. The next scene starts at the current scene's `handoff`
 * label, or `holdMs` after it ends. Events with no scene are ignored; `error` clears everything.
 */
export function createSceneQueue({
  reduced,
  holdMs = 1000,
}: {
  reduced: () => boolean;
  holdMs?: number;
}): SceneQueue {
  const sets = new Set<SceneSet>();
  let pending: SceneEvent[] = [];
  let running = false;
  let generation = 0;
  let wake: (() => void) | null = null;
  const playing = new Set<Timeline>();

  function stopHold(key: string) {
    for (const set of sets) {
      set.holds[key]?.kill();
      delete set.holds[key];
    }
  }

  function clear() {
    generation += 1;
    running = false;
    pending = [];
    for (const set of sets) {
      for (const key of Object.keys(set.holds)) stopHold(key);
    }
    for (const tl of playing) tl.kill();
    playing.clear();
    wake?.();
    wake = null;
  }

  async function drain() {
    const mine = generation;
    running = true;
    while (pending.length) {
      const event = pending.shift()!;
      const make = [...sets].map((set) => set.scenes[event.name]).find(Boolean);
      if (!make) continue;
      const key = who(event.name);
      stopHold(key);
      const tl = make(event.data);
      const handoff = tl.labels.handoff;
      const isReduced = reduced();
      await new Promise<void>((resolve) => {
        wake = resolve;
        playing.add(tl);
        if (handoff !== undefined) tl.call(resolve, null, handoff);
        const previous = tl.eventCallback("onComplete") as (() => void) | undefined;
        tl.eventCallback("onComplete", () => {
          previous?.();
          playing.delete(tl);
          resolve();
        });
        if (isReduced) {
          tl.progress(1);
          stopHold(key);
        } else {
          tl.play();
        }
      });
      if (mine !== generation) return;
      // A handoff lets the next character start at once while this scene's tail keeps playing.
      if (handoff === undefined || isReduced) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, holdMs);
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        if (mine !== generation) return;
      }
    }
    running = false;
  }

  return {
    register(set) {
      sets.add(set);
      return () => {
        for (const key of Object.keys(set.holds)) {
          set.holds[key].kill();
          delete set.holds[key];
        }
        sets.delete(set);
      };
    },
    emit(event) {
      if (event.name === "error") {
        clear();
        return;
      }
      pending.push(event);
      if (!running) {
        // a scene that throws must not stall the queue for good
        drain().catch(() => {
          running = false;
        });
      }
    },
    clear,
  };
}
