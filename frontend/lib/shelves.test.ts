import { expect, test } from "vitest";

import { groupByShelf, OTHER_COLOR, SHELVES, shelfOf } from "./shelves";

test("shelfOf is the first folder, or other for a top-level file", () => {
  expect(shelfOf("about-kenneth/personal.md")).toBe("about-kenneth");
  expect(shelfOf("notes.md")).toBe("other");
  expect(shelfOf("a/b/c/deep.md")).toBe("a");
});

test("groupByShelf lists known shelves in order, then unknown A to Z, then other", () => {
  const docs = [
    { filename: "top.md" },
    { filename: "zeta-shelf/z.md" },
    { filename: "rag-basics/r.md" },
    { filename: "new-shelf/n.md" },
    { filename: "about-kenneth/a.md" },
    { filename: "rag-basics/r2.md" },
  ];
  const groups = groupByShelf(docs);
  expect(groups.map((g) => g.shelf.id)).toEqual([
    "about-kenneth",
    "rag-basics",
    "new-shelf",
    "zeta-shelf",
    "other",
  ]);
  expect(groups[1].docs.map((d) => d.filename)).toEqual(["rag-basics/r.md", "rag-basics/r2.md"]);
  expect(groups[2].shelf).toMatchObject({ name: "New shelf", questions: [], color: OTHER_COLOR });
  expect(groups[4].shelf.name).toBe("Other");
});

test("every listed shelf has its own colour", () => {
  expect(new Set(SHELVES.map((s) => s.color)).size).toBe(SHELVES.length);
});
