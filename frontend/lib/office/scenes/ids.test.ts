import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const read = (...parts: string[]) => readFileSync(resolve(__dirname, ...parts), "utf8");

// Ids and classes the scenes create at run time (buildProps in ask.ts).
const MADE_BY_CODE = new Set(["a-slip", "j-pile", "j-rejects", "st-kept", "a-sheet", "typed-line"]);
// Ids the scenes build from a character prefix, such as `#${who}-flip`.
const BY_PREFIX = {
  upload: ["ch-flip", "tr-flip", "ar-flip", "chopper", "translator", "archivist"],
  ask: [
    "cl-flip",
    "tr-flip",
    "sc-flip",
    "jd-flip",
    "st-flip",
    "clerk",
    "translator",
    "scout",
    "judge",
    "storyteller",
    "sc-arm-up",
    "sc-arm-down",
    "sc-tool-down",
    "jd-arm-up",
    "jd-arm-down",
    "jd-tool-down",
    "st-arm-up",
    "st-arm-down",
    "st-tool-down",
    "tr-check",
    "sc-check",
    "jd-check",
    "st-check",
  ],
  query: [],
} as const;

const rooms = [
  { room: "upload", scene: "upload.ts", svg: "upload-room.svg" },
  { room: "ask", scene: "ask.ts", svg: "ask-room.svg" },
  { room: "query", scene: "query.ts", svg: "query-room.svg" },
] as const;

/** Selectors (`#id`, `.class`) inside the string literals, and the names given to spot(root, "..."). */
function used(source: string) {
  const ids = new Set<string>();
  const classes = new Set<string>();
  const spots = new Set<string>();
  for (const [, name] of source.matchAll(/spot\(root, "([\w-]+)"\)/g)) spots.add(name);
  for (const match of source.matchAll(/"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\\n]|\\.)*)`/g)) {
    const literal = match[1] ?? match[2];
    for (const part of literal.split(/[,>\s]+/)) {
      const id = /^#([a-z][\w-]*)$/.exec(part);
      if (id) ids.add(id[1]);
      const cls = /^\.([a-z][\w-]*)$/.exec(part);
      if (cls) classes.add(cls[1]);
    }
  }
  return { ids, classes, spots };
}

describe.each(rooms)("$room scenes", ({ room, scene, svg }) => {
  const source = read(scene);
  const art = read("..", "..", "..", "public", "office", svg);
  const { ids, classes, spots } = used(source);

  test("every id the scenes use is in the room SVG", () => {
    const missing = [...ids, ...BY_PREFIX[room]].filter(
      (id) => !MADE_BY_CODE.has(id) && !art.includes(`id="${id}"`),
    );
    expect(missing).toEqual([]);
  });

  test("every class the scenes use is in the room SVG", () => {
    const missing = [...classes].filter(
      (c) => !MADE_BY_CODE.has(c) && !new RegExp(`class="[^"]*\\b${c}\\b`).test(art),
    );
    expect(missing).toEqual([]);
  });

  test("every spot the scenes read is a marker in the room SVG", () => {
    const missing = [...spots].filter((name) => !art.includes(`id="spot-${name}"`));
    expect(missing).toEqual([]);
  });
});

test("the scenes use some ids (the extraction works)", () => {
  expect(used(read("upload.ts")).ids.size).toBeGreaterThan(30);
  expect(used(read("ask.ts")).spots.size).toBe(14);
});
