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

test("the second look puts the Judge to work, leaves the Scout alone, and ends with the Judge done", () => {
  const judged: Record<string, Phase> = { scout: "done", judge: "done" };
  const checking = sceneReducer(judged, event("second_look", "start"));
  expect(checking).toEqual({ scout: "done", judge: "working" });
  const trip = sceneReducer(checking, event("second_look", "done", { query: "Batam city" }));
  expect(trip).toEqual({ scout: "done", judge: "done" });
  const enough = sceneReducer(checking, event("second_look", "done", { query: null, enough: 0.9 }));
  expect(enough).toEqual({ scout: "done", judge: "done" });
});

test("round 2 translator, scout and judge starts put each to work again, and their done events finish them", () => {
  let state: Record<string, Phase> = { translator: "done", scout: "done", judge: "done" };
  state = sceneReducer(state, event("translator", "start"));
  expect(state).toEqual({ translator: "working", scout: "done", judge: "done" });
  state = sceneReducer(state, event("translator", "done", { round: 2 }));
  state = sceneReducer(state, event("scout", "start"));
  expect(state).toEqual({ translator: "done", scout: "working", judge: "done" });
  state = sceneReducer(state, event("scout", "done", { round: 2 }));
  state = sceneReducer(state, event("judge", "start"));
  expect(state.judge).toBe("working");
  state = sceneReducer(state, event("judge", "done", { round: 2 }));
  expect(state).toEqual({ translator: "done", scout: "done", judge: "done" });
});

test("second look events have scenes of their own, and round 2 never means nothing found", () => {
  expect(toSceneEvents(event("second_look", "start"))).toEqual([{ name: "second_look_start" }]);
  expect(toSceneEvents(event("second_look", "done", { query: null }))).toEqual([
    { name: "judge_handover" },
  ]);
  const second = event("judge", "done", { round: 2, results: [{ kept: false }], final: ["A"] });
  expect(toSceneEvents(second)).toEqual([{ name: "judge_done", data: { nothing: false } }]);
  // A final check follows: the Judge only rules, then the check hands over or tells the Clerk.
  const checked = event("judge", "done", { round: 2, results: [{ kept: true }], check: true });
  expect(toSceneEvents(checked)).toEqual([{ name: "judge_ruled" }]);
  expect(toSceneEvents(event("second_look", "done", { round: 2, nothing: true }))).toEqual([
    { name: "second_look_nothing" },
  ]);
  expect(toSceneEvents(event("second_look", "done", { round: 2, nothing: false }))).toEqual([
    { name: "judge_handover" },
  ]);
});

test("a first-round verdict that leads to a second look only rules; the check then rewrites or hands over", () => {
  const ruled = event("judge", "done", { round: 1, second_look: true, results: [{ kept: true }] });
  expect(toSceneEvents(ruled)).toEqual([{ name: "judge_ruled" }]);
  const nothing = event("judge", "done", { round: 1, second_look: true, results: [{ kept: false }] });
  expect(toSceneEvents(nothing)).toEqual([{ name: "judge_done", data: { nothing: true } }]);
  expect(toSceneEvents(event("second_look", "done", { query: "Batam city" }))).toEqual([
    { name: "second_look_rewrite", data: { query: "Batam city" } },
  ]);
  expect(toSceneEvents(event("second_look", "done", { query: null, enough: 0.9 }))).toEqual([
    { name: "judge_handover" },
  ]);
  expect(
    toSceneEvents(event("second_look", "done", { query: null, nothing: true, relevant: 0.02 })),
  ).toEqual([{ name: "second_look_nothing" }]);
  const plain = event("judge", "done", { round: 1, second_look: false, results: [{ kept: true }] });
  expect(toSceneEvents(plain)).toEqual([{ name: "judge_done", data: { nothing: false } }]);
});
