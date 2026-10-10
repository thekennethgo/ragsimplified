import type { SceneEvent, SceneHooks, SceneSet, Timeline } from "./types";

export type SceneQueue = {
  register(set: SceneSet): () => void;
  emit(event: SceneEvent, hooks?: SceneHooks): void;
  clear(): void;
  /** Runs every outstanding hook, stops every scene and loop, and resets the rooms. */
  skipAll(): void;
};

/** `chopper_start` belongs to the chopper: its next scene ends its "still working" loop. */
const who = (name: string) => name.split("_")[0];

/**
 * Plays scenes one at a time, in order. The next scene starts at the current scene's `handoff`
 * label, or `holdMs` after it ends, and `gapMs` later still when a different character takes over.
 * An event's hooks run around its scene (both at once when it has none). While `skip` is true no
 * scene is built or played: each event just runs its hooks. `error` runs the hooks not yet run, then clears everything.
 */
export function createSceneQueue({
  reduced,
  skip = () => false,
  holdMs = 1000,
  gapMs = 0,
}: {
  reduced: () => boolean;
  skip?: () => boolean;
  holdMs?: number;
  gapMs?: number;
}): SceneQueue {
  const sets = new Set<SceneSet>();
  type Item = { event: SceneEvent; hooks: SceneHooks; started: boolean };
  let pending: Item[] = [];
  let current: Item | null = null;
  let lastWho: string | null = null;
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
    current = null;
    lastWho = null;
    for (const set of sets) {
      for (const key of Object.keys(set.holds)) stopHold(key);
    }
    for (const tl of playing) tl.kill();
    playing.clear();
    wake?.();
    wake = null;
  }

  /** Runs the hooks of the scene in progress and of every event still waiting. */
  function runOutstanding() {
    const unfinished = current;
    const waiting = pending;
    if (unfinished) {
      if (!unfinished.started) unfinished.hooks.onStart?.();
      unfinished.hooks.onEnd?.();
    }
    for (const item of waiting) {
      item.hooks.onStart?.();
      item.hooks.onEnd?.();
    }
  }

  async function drain() {
    const mine = generation;
    running = true;
    while (pending.length) {
      const item = pending.shift()!;
      const { event, hooks } = item;
      if (skip()) {
        hooks.onStart?.();
        hooks.onEnd?.();
        continue;
      }
      const make = [...sets].map((set) => set.scenes[event.name]).find(Boolean);
      if (!make) {
        hooks.onStart?.();
        hooks.onEnd?.();
        continue;
      }
      const key = who(event.name);
      if (gapMs > 0 && lastWho !== null && lastWho !== key) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, gapMs);
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        if (mine !== generation) return;
      }
      stopHold(key);
      current = item;
      item.started = true;
      hooks.onStart?.();
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
      hooks.onEnd?.();
      current = null;
      lastWho = key;
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
    emit(event, hooks = {}) {
      if (event.name === "error") {
        // let the UI catch up with every step the office hadn't reached yet
        runOutstanding();
        clear();
        return;
      }
      pending.push({ event, hooks, started: false });
      if (!running) {
        // a scene that throws must not stall the queue for good
        drain().catch(() => {
          running = false;
        });
      }
    },
    clear,
    skipAll() {
      runOutstanding();
      clear();
      for (const set of sets) set.reset();
    },
  };
}
