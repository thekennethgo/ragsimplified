# Library to-do (written 2026-11-03)

What to add to and remove from `corpus/`, and what to remember while doing it. Follow `docs/ADDING_DOCUMENTS.md` for the mechanics (`make seed`, evals, Supabase).

## Remember first

- **The title comes from the file.**
  - Markdown: the first `# Title` line.
  - PDF and `.txt`: the file name. Dashes become spaces and it is title-cased (`project-one-pager.pdf` → "Project One Pager"). A name of 3 letters or fewer is upper-cased (`cv.pdf` → "CV", since step 7.9s).
  - So name every PDF the way you want it to read, and check the title after `make seed`.
- **The CV.**
  - Its title is "CV" locally. On Supabase, run:
    ```sql
    UPDATE documents SET title = 'CV' WHERE title = 'Cv';
    ```
  - If you also want the file itself called `CV.pdf`, a rename alone does nothing: the content hash is unchanged, so `make seed` skips it. You must also:
    - rename `corpus/about-kenneth/cv.pdf` and `frontend/public/corpus/about-kenneth/cv.pdf`;
    - change the key in `corpus/sources.json` and `frontend/public/corpus/sources.json`;
    - change the row in `corpus/README.md`;
    - run on both databases:
      ```sql
      UPDATE documents SET filename = 'about-kenneth/CV.pdf' WHERE filename = 'about-kenneth/cv.pdf';
      ```
- **Editing a file adds a second document.** The old one stays until you delete it by hand (there is no delete tool yet).
- **Removing a file** needs `DELETE FROM documents WHERE filename = '…';` (its chunks go with it), then `make seed` to refit the map, on both databases. It also needs the README row, the `sources.json` entry and any eval question that names it removed.
- **Public only.** `corpus/` is public in the repo, so no phone number, address or anything private.
- **After any change:** run `make eval` and add 2–3 questions per new document to `evals/questions.jsonl`.

## Add (most useful first)

| # | File | Shelf | Why |
|---|------|-------|-----|
| 1 | One write-up per major project, e.g. `about-kenneth/project-rag-visualised.md` and one per other project: problem, what you built, stack, result, what you'd change | About the creator | "What project is Kenneth most proud of?" is a featured chip, and today it draws on one summary file. |
| 2 | `about-kenneth/skills.md`: each skill with where you used it | About the creator | Gives evidence-backed answers to "Does Kenneth know X?" |
| 3 | `about-kenneth/why-i-built-this.md`: a short personal note | About the creator | Answers what a visitor or employer asks first. |
| 4 | A second real PDF, e.g. `about-kenneth/Project-One-Pager.pdf` or a certificate | About the creator | Shows the PDF viewer and page highlighting on something other than the CV. |
| 5 | `rag-basics/glossary.md`: embedding, chunk, token, reranker, hallucination, in plain English | RAG basics | Backs up the "How does RAG work?" chip and the new Under the hood copy. |
| 6 | `rag-basics/rag-vs-fine-tuning.md`: RAG vs fine-tuning vs long context | RAG basics | A common question that nothing on file answers. |
| 7 | `this-project/when-it-gets-it-wrong.md`: real failure cases and why they happen | This project | Fits the site's honesty theme, and gives the second look something to explain. |

## Remove (or slim down)

| File(s) | Why | Before removing |
|---|---|---|
| `general/chess.md`, `general/great-barrier-reef.md` | No eval uses them, and they show up as noise in off-topic answers (Chess appeared for the basketball question). | Nothing else depends on them. |
| `general/coffee.md`, `general/apollo-11.md`, `general/world-wide-web.md` | Same noise problem: Coffee was kept for the Batam food question, and Apollo 11 for basketball. | Each is used by eval questions (coffee 2, apollo-11 1, world-wide-web 1): drop or rewrite those first, or keep one as an off-topic control. |
| `places-and-interests/mixed-martial-arts.md` vs `ufc.md` | They overlap heavily; keep the one that links to your own interests. | No eval uses either. |

Keep `movies-and-games/` and the rest of `places-and-interests/`: the second look's indirect questions ("What food is popular where Kenneth grew up?", favourite films) depend on them.
