import { expect, test } from "vitest";

import type { StepEvent } from "./backend";
import { sceneReducer, toSceneEvents, type Phase } from "./sceneState";

const event = (step: string, status: "start" | "done", data?: StepEvent["data"]): StepEvent => ({
  step,
  status,
  data,
});

test("a step is working after start and done after done", () => {
  let state: Record<string, Phase> = {};
  state = sceneReducer(state, event("chopper", "start"));
  expect(state).toEqual({ chopper: "working" });
  state = sceneReducer(state, event("chopper", "done"));
  state = sceneReducer(state, event("translator", "start"));
  expect(state).toEqual({ chopper: "done", translator: "working" });
});

test("an error marks what was running as an error and leaves finished steps alone", () => {
  const state = sceneReducer({ chopper: "done", translator: "working" }, event("error", "done"));
  expect(state).toEqual({ chopper: "done", translator: "error" });
});

test("step events become <step>_<status> scene events", () => {
  expect(toSceneEvents(event("scout", "start"))).toEqual([{ name: "scout_start" }]);
  expect(toSceneEvents(event("storyteller", "done"))).toEqual([{ name: "storyteller_done" }]);
});

test("an error event becomes the error scene event", () => {
  expect(toSceneEvents(event("error", "done"))).toEqual([{ name: "error" }]);
});

test("the Judge's done event says whether anything was kept", () => {
  const kept = event("judge", "done", { results: [{ kept: false }, { kept: true }] });
  expect(toSceneEvents(kept)).toEqual([{ name: "judge_done", data: { nothing: false } }]);
  const none = event("judge", "done", { results: [{ kept: false }] });
  expect(toSceneEvents(none)).toEqual([{ name: "judge_done", data: { nothing: true } }]);
  expect(toSceneEvents(event("judge", "done"))).toEqual([
    { name: "judge_done", data: { nothing: true } },
  ]);
  expect(toSceneEvents(event("judge", "start"))).toEqual([{ name: "judge_start" }]);
});
