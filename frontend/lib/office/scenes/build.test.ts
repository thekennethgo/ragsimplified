import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import gsap from "gsap";
import { afterEach, describe, expect, test } from "vitest";

import { buildAskScenes } from "./ask";
import { buildQueryScenes } from "./query";
import { buildUploadScenes } from "./upload";
import { at, spot } from "../spots";
import type { SceneSet } from "../types";

// jsdom has no SVG geometry; GSAP only needs these to exist for transforms with an svgOrigin.
const svgProto = SVGElement.prototype as unknown as Record<string, unknown>;
svgProto.getBBox ??= () => ({ x: 0, y: 0, width: 0, height: 0 });
svgProto.getCTM ??= () => null;
svgProto.getScreenCTM ??= () => null;
if (!("transform" in svgProto)) {
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  Object.defineProperty(SVGElement.prototype, "transform", {
    get: () => ({ baseVal: { numberOfItems: 0, consolidate: () => ({ matrix: identity }) } }),
  });
}

function load(file: string): SVGSVGElement {
  document.body.innerHTML = readFileSync(
    resolve(__dirname, "../../../public/office", file),
    "utf8",
  );
  return document.querySelector("svg")!;
}

const rooms: {
  room: string;
  file: string;
  build: (root: SVGSVGElement) => SceneSet;
  scenes: string[];
  handoffs: string[];
}[] = [
  {
    room: "upload",
    file: "upload-room.svg",
    build: buildUploadScenes,
    scenes: [
      "chopper_start",
      "chopper_done",
      "translator_start",
      "translator_done",
      "archivist_start",
      "archivist_done",
    ],
    handoffs: ["chopper_done", "translator_done"],
  },
  {
    room: "ask",
    file: "ask-room.svg",
    build: buildAskScenes,
    scenes: [
      "question_start",
      "translator_start",
      "translator_done",
      "scout_start",
      "scout_done",
      "judge_start",
      "judge_done",
      "judge_ruled",
      "judge_handover",
      "second_look_rewrite",
      "storyteller_start",
      "storyteller_done",
      "second_look_nothing", // last: it sets "nothing found", which empties the Storyteller's scenes
    ],
    handoffs: [
      "question_start",
      "translator_done",
      "scout_done",
      "judge_done",
      "judge_handover",
      "second_look_rewrite",
      "second_look_nothing",
      "storyteller_done",
    ],
  },
  {
    room: "query",
    file: "query-room.svg",
    build: buildQueryScenes,
    scenes: ["clerk_away", "clerk_back", "clerk_shrug"],
    handoffs: ["clerk_away"],
  },
];

afterEach(() => {
  document.body.innerHTML = "";
});

describe.each(rooms)("$room room", ({ file, build, scenes, handoffs }) => {
  test("builds every scene as a timeline, with a handoff where the next character can start", () => {
    const set = build(load(file));
    set.reset();
    expect(Object.keys(set.scenes).sort()).toEqual([...scenes].sort());
    for (const name of scenes) {
      const tl = set.scenes[name]();
      expect(tl.duration(), name).toBeGreaterThan(0);
      expect("handoff" in tl.labels, name).toBe(handoffs.includes(name));
      tl.kill();
    }
  });
});

test("the Judge's nothing-found scene crosses the board and the Storyteller has nothing to do", () => {
  const set = buildAskScenes(load("ask-room.svg"));
  set.reset();
  const normal = set.scenes.judge_done();
  const nothing = set.scenes.judge_done({ nothing: true });
  expect(nothing.duration()).not.toBe(normal.duration());
  expect("handoff" in nothing.labels).toBe(true);
  // after "nothing kept" the Storyteller's scenes are empty
  expect(set.scenes.storyteller_start().duration()).toBeLessThan(0.1);
  expect(set.scenes.storyteller_done().duration()).toBeLessThan(0.1);
});

test("storyteller_done ends with the answer on the board", () => {
  const root = load("ask-room.svg");
  const set = buildAskScenes(root);
  set.reset();
  const tl = set.scenes.storyteller_done();
  tl.progress(1);
  const marks = [...root.querySelectorAll("#board-a > *")];
  expect(marks).toHaveLength(3);
  for (const mark of marks) expect(Number(gsap.getProperty(mark, "opacity"))).toBe(1);
  tl.kill();
});

test("the Storyteller walks back to her desk after writing on the board", () => {
  const root = load("ask-room.svg");
  const set = buildAskScenes(root);
  set.reset();
  const tl = set.scenes.storyteller_done();
  tl.progress(1);
  const home = spot(root, "storyteller");
  expect(Number(gsap.getProperty(root.querySelector("#storyteller")!, "x"))).toBeCloseTo(at(home).x, 3);
  expect(Number(gsap.getProperty(root.querySelector("#storyteller")!, "y"))).toBeCloseTo(at(home).y, 3);
  tl.kill();
});
