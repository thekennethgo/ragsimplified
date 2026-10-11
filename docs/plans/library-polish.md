# Plan: library shelves, starter questions by shelf, source lines, map colours by shelf

Owner: Kenneth Go. Written 2026-10-11. For an implementing agent (Sonnet). Run it after [launch-library.md](launch-library.md) step L9, when `corpus/` has its final folders.

## Rules for the implementing agent

- Do the steps in order. One step = one branch and one PR (`step-P<n>-<short-name>`), unless the owner says to bundle.
- Never commit, push or open a PR until the owner says so. Never merge.
- Do exactly what each step says; if something is impossible or looks wrong, stop and ask.
- Frontend only, except P3's seed change and P4's extra field on `GET /map`. No new endpoints, no migrations.
- Before finishing each step: `make lint` and `make test`. End with a report: files changed, how to verify, anything unsure.

## Decisions (already made, do not re-decide)

- A shelf is the first folder of a document's `filename` from `GET /library` (`about-kenneth/personal.md` is on the `about-kenneth` shelf). A file at the top of `corpus/` is on the `other` shelf.
- Shelf names, order and starter questions live in one new file, `frontend/lib/shelves.ts`. Folders it does not list are shown after the listed ones, named by turning the folder into words (`new-shelf` becomes "New shelf").
- Source and licence lines come from a new `corpus/sources.json`, which `make seed` copies to `frontend/public/corpus/sources.json`. The frontend fetches `/corpus/sources.json`. No database change.

## Steps

### P1. Shelves in the File cabinet

- New `frontend/lib/shelves.ts`:

  ```ts
  export type Shelf = { id: string; name: string; questions: string[] };

  export const SHELVES: Shelf[] = [
    { id: "about-kenneth", name: "About Kenneth", questions: ["Where did Kenneth grow up?", "What projects is Kenneth most proud of?"] },
    { id: "this-project", name: "This project", questions: ["How does the Judge pick the best sources?", "Is my pasted text stored anywhere?"] },
    { id: "rag-basics", name: "RAG basics", questions: ["What is retrieval-augmented generation?", "What is a vector database?"] },
    { id: "how-ai-works", name: "How AI works", questions: ["How does a transformer work?", "Why do language models hallucinate?"] },
    { id: "ai-history", name: "AI history", questions: ["Where did the term artificial intelligence come from?", "What was the AI winter?"] },
    { id: "ai-and-society", name: "AI and society", questions: ["How could AI affect jobs?", "What is algorithmic bias?"] },
    { id: "lore", name: "RAG.co lore (fictional)", questions: ["What does the RAG.co staff handbook say about lunch breaks?", "What is the no-guessing guarantee in the Query Desk terms?"] },
    { id: "real-reports", name: "Real reports", questions: ["What are the four functions of the NIST AI Risk Management Framework?"] },
    { id: "places-and-interests", name: "Places & interests", questions: ["What is Batam known for?"] },
    { id: "movies-and-games", name: "Movies & games", questions: ["What is Ex Machina about?", "What is Watch Dogs about?"] },
    { id: "general", name: "General", questions: ["Which chess champion lost to Deep Blue?"] },
  ];

  /** The shelf id of a library filename: its first folder, or "other". */
  export function shelfOf(filename: string): string;

  /** Documents grouped by shelf, in SHELVES order, then unknown shelves A to Z, then "other". */
  export function groupByShelf<T extends { filename: string }>(docs: T[]): { shelf: Shelf; docs: T[] }[];
  ```

  Unknown shelves get `questions: []` and a name made from the folder (hyphens to spaces, first letter capital). The `other` shelf is named "Other".
- Before writing the questions, check each one against the real documents in `corpus/`. Replace any question that the documents cannot answer (the NIST one depends on L6) and tell the owner which ones changed.
- `frontend/components/LibraryPanel.tsx`: in the "Shared library" group, render one sub-list per shelf from `groupByShelf(starter)`, each with an `<h4>` shelf name and the shelf's document count. Keep each document's open button or link and its card count exactly as they are now. Add the CSS for the shelf heading to the panel's existing CSS module, reusing its tokens.
- Tests: `frontend/lib/shelves.test.ts` (`shelfOf` for a nested path, a top-level file and a deep path; `groupByShelf` order with known, unknown and top-level files); update `frontend/components/LibraryPanel.test.tsx` so documents from two folders show under two shelf headings.

### P2. Starter questions by shelf on the Ask page

- `frontend/app/ask/page.tsx`: remove the `EXAMPLES` constant. Build the examples from the shelves that have at least one document in the library: up to 2 questions per shelf, in `SHELVES` order, at most 8 in total.
- `frontend/components/ask/QuestionBubble.tsx`: change the `examples` prop from `string[]` to `{ shelf: string; questions: string[] }[]` and render each shelf's name as a small label before its questions. Clicking a question keeps today's behaviour. While the library is still loading, show no examples.
- Tests: update `frontend/app/ask/page.test.tsx` and the `QuestionBubble` tests: only shelves present in a mocked `GET /library` show questions, the shelf label is shown, and clicking a question fills the box.

### P3. Source and licence line in the viewer

- New `corpus/sources.json`, one entry per file in `corpus/` (keys are paths relative to `corpus/`):

  ```json
  {
    "rag-basics/vector-database.md": {
      "source": "Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Vector_database",
      "licence": "CC BY-SA 4.0",
      "note": "revision 1374243120"
    },
    "about-kenneth/personal.md": { "source": "Written by Kenneth Go", "licence": "All rights reserved" },
    "lore/staff-handbook.pdf": { "source": "Written for this project (fictional)", "licence": "MIT" }
  }
  ```

  Take every Wikipedia URL and revision from the `> Source:` line at the top of the file, and every PDF's source and licence, from `corpus/README.md`. Project-written docs (`this-project/`, `lore/`) use "Written for this project" and licence "MIT"; Kenneth's own docs use "Written by Kenneth Go" and "All rights reserved".
- `backend/app/seed.py`: after copying the documents, also copy `corpus/sources.json` to `public_dir / "sources.json"` when it exists, and skip `sources.json` as a document (it is not in `SUPPORTED`, so only the copy is new). Add a test in `backend/tests/test_seed.py`.
- New test `backend/tests/test_sources.py`: every supported file in `corpus/` (except `README.md`) has an entry in `corpus/sources.json`, and every entry points at a file that exists. This keeps the file honest when documents are added.
- New `frontend/lib/sources.ts`: `loadSources()` fetches `/corpus/sources.json` once and caches it; returns `{}` on any error.
- `frontend/components/viewer/LibraryDocView.tsx`: under the `<h1>`, a small line: `Source: <a href={url}>{source}</a> · {licence}{note ? ` · ${note}` : ""}` (no link when there is no `url`). Show nothing when the file has no entry.
- Tests: the line renders with a link for a Wikipedia entry, without a link for a written entry, and nothing for a missing entry.

### P4. Colour the vector map by shelf

- `backend/app/map.py`: add `filename: str` to `MapPoint` and select `d.filename` in `GET /map`; update `backend/tests/test_map.py` (or the existing map test file) to check the field.
- `frontend/lib/map.ts`: add `filename: string` to `MapPoint` (`null`-free; private points keep using their own colour).
- `frontend/lib/shelves.ts`: add a `color` to every shelf in `SHELVES` (11 distinct colours that read on the panel background `#F6EFE4`; reuse the map's existing `PALETTE` first and add colours only if it has fewer than 11), and a grey `#8A7A6A` for unknown shelves and `other`.
- `frontend/components/map/VectorMap.tsx`: colour each library dot by `shelfOf(p.filename)` instead of by title; the legend lists shelves (name and colour, only shelves with points) instead of documents; the hover card shows the document title and its shelf name. The visitor's own chunks, the question marker and the Scout's highlights keep their current colours.
- Tests: update `frontend/components/map/VectorMap.test.tsx`: two documents on the same shelf share a colour, documents on different shelves do not, and the legend lists shelf names.

## Verification

```bash
make lint
```

```bash
make test
```

```bash
make seed
```

Then on http://localhost:3000: the File cabinet shows the documents under shelf headings in the order above; the Ask page shows starter questions grouped by shelf and each one gets a cited answer; opening a Wikipedia document in the viewer shows its source link, licence and revision, and a project document shows "Written for this project · MIT"; the Map tab colours dots by shelf with a shelf legend.
