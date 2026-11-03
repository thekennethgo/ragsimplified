import { expect, test } from "vitest";

import type { About } from "./about";
import { askTranslatorCopy, judgeCopy, scoutCopy, storytellerCopy } from "./characters";

const withTokens = (max_tokens: number | null) =>
  ({
    llm: { provider: "x", model: "claude-x", max_tokens },
    judge: { keep: 5, max_per_document: 2 },
    second_look: { enabled: false },
  }) as About;

const longest = (about: About) =>
  storytellerCopy(about).settings.find(([label]) => label === "Longest answer")![1];

test("the Storyteller's longest answer shows the token limit, or the model's default", () => {
  expect(longest(withTokens(1024))).toBe("1024 tokens");
  expect(longest(withTokens(null))).toBe("the model's default");
});

test("the Judge's how text states the per-document cap", () => {
  const about = { ...withTokens(null), scout: { candidates: 20 } } as About;
  expect(judgeCopy(about).how).toContain(
    "No more than 2 cards come from the same document, so one document cannot fill every place.",
  );
});

test("the Judge's how text says whether the second look is on and what decides it", () => {
  const look = { enabled: true, decider: "inception/mercury-decide", slots: 2, max_cards: 7, threshold: 0.5, nothing_threshold: 0.1 };
  const on = { ...withTokens(null), scout: { candidates: 20 }, second_look: look } as About;
  expect(judgeCopy(on).how).toContain("The second look is on");
  expect(judgeCopy(on).how).toContain("Mercury Decide");
  expect(judgeCopy(on).how).not.toContain("inception/mercury-decide");
  expect(judgeCopy(on).how).toContain("I keep the best 2 new cards; they join the first search's 5, so the Storyteller gets up to 7");
  const off = { ...on, second_look: { ...look, enabled: false } } as About;
  expect(judgeCopy(off).how).toContain("The second look is off.");
  expect(judgeCopy(null).how).not.toContain("second look");
  expect(scoutCopy(on).how).not.toContain("The second look is on");
});

test("the Translator and Scout say what they do on a second look", () => {
  expect(askTranslatorCopy(null).how).toContain(
    "On a second look it fingerprints the new query too.",
  );
  expect(scoutCopy(null).how).toContain(
    "On a second look it searches again for the new query and skips cards it already found.",
  );
});
