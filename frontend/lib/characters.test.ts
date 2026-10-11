import { expect, test } from "vitest";

import type { About } from "./about";
import { judgeCopy, storytellerCopy } from "./characters";

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
