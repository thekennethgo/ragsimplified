import { expect, test } from "vitest";

import { newText } from "./overlap";

test("returns the text unchanged when there is no previous chunk", () => {
  expect(newText(undefined, "First chunk.")).toBe("First chunk.");
});

test("drops the overlap shared with the end of the previous chunk", () => {
  const prev = "Some earlier sentence. The shared tail of the previous chunk";
  const text = "The shared tail of the previous chunk and then new words.";
  expect(newText(prev, text)).toBe("and then new words.");
});

test("keeps the text when nothing overlaps", () => {
  expect(newText("Alpha beta gamma delta.", "Completely different text here.")).toBe(
    "Completely different text here.",
  );
});

test("drops a short previous chunk that is fully contained at the start", () => {
  expect(newText("Short.", "Short. And more follows.")).toBe("And more follows.");
});

test("keeps a 3-character accidental match", () => {
  expect(newText("A long previous chunk ending in the", "the cat sat on the mat")).toBe(
    "the cat sat on the mat",
  );
});
