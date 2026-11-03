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

const points = (c: { how: { points: string[] } }) => c.how.points.join("\n");

test("the Judge's points state the per-document cap", () => {
  const about = { ...withTokens(null), scout: { candidates: 20 } } as About;
  expect(points(judgeCopy(about))).toContain(
    "At most 2 cards come from one document, so one long document can't take every place.",
  );
});

test("the Judge's points say whether the second look is on and what decides it", () => {
  const look = { enabled: true, decider: "inception/mercury-decide", slots: 2, max_cards: 7, threshold: 0.5, nothing_threshold: 0.1 };
  const on = { ...withTokens(null), scout: { candidates: 20 }, second_look: look } as About;
  expect(points(judgeCopy(on))).toContain("Then the second look: Mercury Decide");
  expect(points(judgeCopy(on))).not.toContain("inception/mercury-decide");
  expect(points(judgeCopy(on))).toContain("At 50% or more");
  expect(points(judgeCopy(on))).toContain("I keep the best 2 new cards, ranked against the follow-up. With the first 5, the Storyteller gets up to 7");
  const plain = { ...on, second_look: { ...look, decider: null } } as About;
  expect(points(judgeCopy(plain))).toContain("Then the second look: a short language-model call");
  expect(points(judgeCopy(plain))).not.toContain("Mercury Decide");
  const off = { ...on, second_look: { ...look, enabled: false } } as About;
  expect(judgeCopy(off).how.points).toContain("The second look is off.");
  expect(points(judgeCopy(null))).not.toContain("second look");
  expect(points(scoutCopy(on))).not.toContain("Then the second look");
});

test("the Translator and Scout say what they do on a second look", () => {
  expect(points(askTranslatorCopy(null))).toContain("On a second look, I fingerprint the follow-up search the same way.");
  expect(points(scoutCopy(null))).toContain(
    "On a second look, I search again for the follow-up and skip cards I already found.",
  );
});

test("the Storyteller mentions the fallback model only when one is set", () => {
  const base = withTokens(null);
  const set = { ...base, llm: { ...base.llm, fallback_model: "claude-y" } } as About;
  expect(points(storytellerCopy(set))).toContain("through OpenRouter");
  expect(points(storytellerCopy(base))).not.toContain("OpenRouter");
});
