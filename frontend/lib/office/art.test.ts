import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const rooms = ["upload-room.svg", "ask-room.svg", "break-room.svg"];

/** The markup of the group with this id, up to its matching closing tag. */
function group(art: string, id: string): string {
  const start = art.indexOf(`<g id="${id}"`);
  expect(start, `${id} is missing`).toBeGreaterThan(-1);
  let depth = 0;
  for (const tag of art.slice(start).matchAll(/<(\/?)g\b[^>]*>/g)) {
    depth += tag[1] ? -1 : 1;
    if (depth === 0) return art.slice(start, start + tag.index! + tag[0].length);
  }
  throw new Error(`${id} is not closed`);
}

describe.each(rooms)("%s", (svg) => {
  const art = readFileSync(resolve(__dirname, "../../public/office", svg), "utf8");

  test.each([
    ["meow", "meow-"],
    ["rug", "rug-"],
  ])("has the %s group, hidden from assistive technology, with only %s parts", (id, prefix) => {
    const markup = group(art, id);
    expect(markup).toContain('aria-hidden="true"');
    const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]).filter((i) => i !== id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((i) => !i.startsWith(prefix))).toEqual([]);
  });

  test("Meow has a body, head, ears, tail and closed eyes", () => {
    const markup = group(art, "meow");
    for (const part of ["body", "head", "ear-left", "ear-right", "tail", "eyes"]) {
      expect(markup).toContain(`id="meow-${part}"`);
    }
  });

  test("the rug has a base, border and logo", () => {
    const markup = group(art, "rug");
    for (const part of ["base", "border", "logo"]) expect(markup).toContain(`id="rug-${part}"`);
    expect(markup).toContain(">RAG.co</text>");
  });

  test("the rug is drawn before the furniture, and the label mentions Meow and the rug", () => {
    expect(art.indexOf('id="rug"')).toBeLessThan(art.indexOf('id="meow"'));
    expect(art.slice(0, art.indexOf('xmlns="')))
      .toContain("with Meow, the office cat, asleep on the shelves, and a RAG.co rug on the floor");
  });
});
