import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

import { EVAL_CASES } from "./evalCases";

test("every card groups a case that exists in the eval questions", () => {
  const file = resolve(__dirname, "../../evals/questions.jsonl");
  const cases = new Set(
    readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line).case),
  );
  expect(EVAL_CASES).toHaveLength(8);
  for (const card of EVAL_CASES) expect(cases.has(card.case)).toBe(true);
});
