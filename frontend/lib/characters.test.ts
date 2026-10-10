import { expect, test } from "vitest";

import type { About } from "./about";
import { storytellerCopy } from "./characters";

const withTokens = (max_tokens: number | null) =>
  ({
    llm: { provider: "x", model: "claude-x", max_tokens },
    judge: { keep: 5 },
  }) as About;

const longest = (about: About) =>
  storytellerCopy(about).settings.find(([label]) => label === "Longest answer")![1];

test("the Storyteller's longest answer shows the token limit, or the model's default", () => {
  expect(longest(withTokens(1024))).toBe("1024 tokens");
  expect(longest(withTokens(null))).toBe("the model's default");
});
