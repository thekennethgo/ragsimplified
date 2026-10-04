import { expect, test } from "vitest";

import { locatePassage } from "./passage";

test("finds a chunk that appears verbatim", () => {
  const text = "Intro paragraph.\n\nThe cited passage is here.\n\nOutro.";
  expect(locatePassage(text, "The cited passage is here.")).toEqual([18, 44]);
});

test("finds a chunk whose blank lines were normalised", () => {
  const first = Array.from({ length: 12 }, (_, i) => `alpha${i}`).join(" ");
  const second = Array.from({ length: 12 }, (_, i) => `bravo${i}`).join(" ");
  const text = `before\n\n${first}\n\n\n\n${second}\n\nafter`;
  const chunk = `${first}\n\n${second}`; // the Chopper joins paragraphs with one blank line
  const found = locatePassage(text, chunk);
  expect(found).not.toBeNull();
  expect(text.slice(found![0], found![1])).toBe(`${first}\n\n\n\n${second}`);
});

test("returns null when the chunk is not in the text", () => {
  expect(locatePassage("some other text", "a chunk that is not there at all")).toBeNull();
});
