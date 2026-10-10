import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { createSceneQueue } from "./sceneQueue";
import type { SceneSet, Timeline } from "./types";

type Fake = Timeline & { reachHandoff(): void; finish(): void };

function setup(
  options: { handoff?: string[]; reduced?: boolean; gapMs?: number; skip?: () => boolean } = {},
) {
  const log: string[] = [];
  const timelines: Record<string, Fake> = {};
  const holds: SceneSet["holds"] = {};
  const scene = (name: string) => () => {
    let onComplete: (() => void) | undefined;
    let atHandoff: (() => void) | undefined;
    const tl: Fake = {
      labels: options.handoff?.includes(name) ? { handoff: 1 } : {},
      duration: () => 2,
      play: () => log.push(`play ${name}`),
      progress: (p: number) => {
        log.push(`progress ${name} ${p}`);
        // like a scene that would start its loop when it completes
        holds[name.split("_")[0]] = { kill: () => log.push(`kill loop ${name}`) };
        onComplete?.();
      },
      kill: () => log.push(`kill ${name}`),
      call: (fn) => {
        atHandoff = fn;
      },
      eventCallback: ((_: "onComplete", fn?: () => void) => {
        if (fn) onComplete = fn;
        return onComplete;
      }) as Timeline["eventCallback"],
      reachHandoff: () => atHandoff?.(),
      finish: () => onComplete?.(),
    };
    timelines[name] = tl;
    return tl;
  };
  const names = ["chopper_start", "chopper_done", "translator_start", "translator_done"];
  const set: SceneSet = {
    reset: vi.fn(),
    scenes: Object.fromEntries(names.map((n) => [n, scene(n)])),
    holds,
  };
  const queue = createSceneQueue({
    reduced: () => options.reduced ?? false,
    skip: options.skip,
    holdMs: 1000,
    gapMs: options.gapMs,
  });
  queue.register(set);
  return { queue, log, timelines, holds, set };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const flush = () => vi.advanceTimersByTimeAsync(0);

test("plays scenes one at a time, in order, a second apart", async () => {
  const { queue, log, timelines } = setup();
  queue.emit({ name: "chopper_start" });
  queue.emit({ name: "chopper_done" });
  await flush();
  expect(log).toEqual(["play chopper_start"]);

  timelines.chopper_start.finish();
  await vi.advanceTimersByTimeAsync(999);
  expect(log).toEqual(["play chopper_start"]);
  await vi.advanceTimersByTimeAsync(1);
  expect(log).toEqual(["play chopper_start", "play chopper_done"]);
});

test("starts the next scene at the handoff label, while the first keeps playing", async () => {
  const { queue, log, timelines } = setup({ handoff: ["chopper_done"] });
  queue.emit({ name: "chopper_done" });
  queue.emit({ name: "translator_start" });
  await flush();
  expect(log).toEqual(["play chopper_done"]);

  timelines.chopper_done.reachHandoff();
  await flush();
  expect(log).toEqual(["play chopper_done", "play translator_start"]);
});

test("a stored hold loop stops when that character's next scene starts", async () => {
  const { queue, holds } = setup();
  const kill = vi.fn();
  holds.chopper = { kill };
  const other = vi.fn();
  holds.translator = { kill: other };
  queue.emit({ name: "chopper_done" });
  await flush();
  expect(kill).toHaveBeenCalledTimes(1);
  expect(holds.chopper).toBeUndefined();
  expect(other).not.toHaveBeenCalled();
});

test("events with no scene are ignored", async () => {
  const { queue, log } = setup();
  queue.emit({ name: "scout_start" });
  queue.emit({ name: "chopper_start" });
  await flush();
  expect(log).toEqual(["play chopper_start"]);
});

test("an error clears the queue, stops every loop and kills the running scene", async () => {
  const { queue, log, holds, timelines } = setup();
  const kill = vi.fn();
  holds.translator = { kill };
  queue.emit({ name: "chopper_start" });
  queue.emit({ name: "chopper_done" });
  await flush();

  queue.emit({ name: "error" });
  expect(kill).toHaveBeenCalled();
  expect(log).toContain("kill chopper_start");
  timelines.chopper_start.finish();
  await vi.advanceTimersByTimeAsync(5000);
  expect(log).not.toContain("play chopper_done");

  // the queue works again afterwards
  queue.emit({ name: "translator_start" });
  await flush();
  expect(log).toContain("play translator_start");
});

test("reduced motion jumps each scene to its end, still a second apart, with no loops", async () => {
  const { queue, log, holds } = setup({ reduced: true, handoff: ["chopper_start"] });
  queue.emit({ name: "chopper_start" });
  queue.emit({ name: "chopper_done" });
  await flush();
  // the first scene has a handoff, but under reduced motion the next one still waits a second
  expect(log).toEqual(["progress chopper_start 1", "kill loop chopper_start"]);
  expect(holds).toEqual({});

  await vi.advanceTimersByTimeAsync(999);
  expect(log).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(log).toContain("progress chopper_done 1");
  expect(log.some((entry) => entry.startsWith("play"))).toBe(false);
});

test("hooks run in order: onStart before the scene plays, onEnd once it finishes", async () => {
  const { queue, log, timelines } = setup();
  queue.emit(
    { name: "chopper_start" },
    { onStart: () => log.push("onStart"), onEnd: () => log.push("onEnd") },
  );
  await flush();
  expect(log).toEqual(["onStart", "play chopper_start"]);
  timelines.chopper_start.finish();
  await flush();
  expect(log).toEqual(["onStart", "play chopper_start", "onEnd"]);
});

test("onEnd runs at the handoff label, while the scene keeps playing", async () => {
  const { queue, log, timelines } = setup({ handoff: ["chopper_done"] });
  queue.emit({ name: "chopper_done" }, { onEnd: () => log.push("onEnd") });
  await flush();
  expect(log).toEqual(["play chopper_done"]);
  timelines.chopper_done.reachHandoff();
  await flush();
  expect(log).toEqual(["play chopper_done", "onEnd"]);
});

test("an event with no scene runs both hooks right away", async () => {
  const { queue, log } = setup();
  queue.emit(
    { name: "scout_start" },
    { onStart: () => log.push("onStart"), onEnd: () => log.push("onEnd") },
  );
  await flush();
  expect(log).toEqual(["onStart", "onEnd"]);
});

test("a new character waits gapMs, the same character does not", async () => {
  const { queue, log, timelines } = setup({ gapMs: 800 });
  queue.emit({ name: "chopper_start" });
  queue.emit({ name: "chopper_done" });
  queue.emit({ name: "translator_start" });
  await flush();
  timelines.chopper_start.finish();
  await vi.advanceTimersByTimeAsync(1000);
  expect(log).toEqual(["play chopper_start", "play chopper_done"]);

  timelines.chopper_done.finish();
  await vi.advanceTimersByTimeAsync(1000);
  expect(log).not.toContain("play translator_start");
  await vi.advanceTimersByTimeAsync(799);
  expect(log).not.toContain("play translator_start");
  await vi.advanceTimersByTimeAsync(1);
  expect(log).toContain("play translator_start");
});

test("skip builds no timeline: each event just runs its hooks, in order", async () => {
  const { queue, log } = setup({ gapMs: 800, skip: () => true });
  const hooks = (name: string) => ({
    onStart: () => log.push(`start ${name}`),
    onEnd: () => log.push(`end ${name}`),
  });
  queue.emit({ name: "chopper_start" }, hooks("chopper_start"));
  queue.emit({ name: "translator_start" }, hooks("translator_start"));
  await flush();
  expect(log).toEqual([
    "start chopper_start",
    "end chopper_start",
    "start translator_start",
    "end translator_start",
  ]);
});

test("skipAll runs the remaining hooks, kills the scene and resets the rooms", async () => {
  const { queue, log, set } = setup();
  const hooks = (name: string) => ({
    onStart: () => log.push(`start ${name}`),
    onEnd: () => log.push(`end ${name}`),
  });
  queue.emit({ name: "chopper_start" }, hooks("chopper_start"));
  queue.emit({ name: "translator_start" }, hooks("translator_start"));
  await flush();
  queue.skipAll();
  expect(log).toEqual([
    "start chopper_start",
    "play chopper_start",
    "end chopper_start",
    "start translator_start",
    "end translator_start",
    "kill chopper_start",
  ]);
  expect(set.reset).toHaveBeenCalledTimes(1);
});

test("an error runs the remaining hooks in order, then kills the timelines", async () => {
  const { queue, log } = setup();
  const hooks = (name: string) => ({
    onStart: () => log.push(`start ${name}`),
    onEnd: () => log.push(`end ${name}`),
  });
  queue.emit({ name: "chopper_start" }, hooks("chopper_start"));
  queue.emit({ name: "chopper_done" }, hooks("chopper_done"));
  queue.emit({ name: "translator_start" }, hooks("translator_start"));
  await flush();
  queue.emit({ name: "error" });
  expect(log).toEqual([
    "start chopper_start",
    "play chopper_start",
    "end chopper_start",
    "start chopper_done",
    "end chopper_done",
    "start translator_start",
    "end translator_start",
    "kill chopper_start",
  ]);
});
