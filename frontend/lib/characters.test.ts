import { expect, test } from "vitest";

import type { About } from "./about";
import { askTranslatorCopy, clerkCopy, judgeCopy, scoutCopy, storytellerCopy } from "./characters";

const withTokens = (max_tokens: number | null) =>
  ({
    llm: { provider: "x", model: "claude-x", max_tokens },
    judge: { keep: 5, max_per_document: 2 },
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
  const look = { enabled: true, decider: "inception/mercury-decide:free", slots: 2 };
  const on = { ...withTokens(null), scout: { candidates: 20 }, second_look: look } as About;
  expect(judgeCopy(on).how).toContain("The second look is on");
  expect(judgeCopy(on).how).toContain("inception/mercury-decide:free");
  expect(judgeCopy(on).how).toContain("best 2 cards of that second search, and they join the first search's best 3");
  const off = { ...on, second_look: { ...look, enabled: false } } as About;
  expect(judgeCopy(off).how).toContain("The second look is off.");
  expect(judgeCopy(null).how).not.toContain("second look");
  expect(scoutCopy(on).how).not.toContain("The second look is on");
});

test("the Clerk, Translator and Scout say what they do on a second look", () => {
  expect(clerkCopy(null).how).toContain(
    "On a second look the Clerk rewrites the question into a short search for the missing details.",
  );
  expect(askTranslatorCopy(null).how).toContain(
    "On a second look it fingerprints the Clerk's new query too.",
  );
  expect(scoutCopy(null).how).toContain(
    "On a second look it searches again for the Clerk's new query and skips cards it already found.",
  );
});
