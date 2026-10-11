# Plan: launch starter library, download button and PDF highlighting

Owner: Kenneth Go. Written 2026-10-11, revised 2026-10-11 (final document list). For an implementing agent (Sonnet) to follow step by step.

## Rules for the implementing agent

- Do the steps in order. One step = one branch and one PR (`step-L<n>-<short-name>`), unless the owner says to bundle.
- Never commit, push or open a PR until the owner says so. Never merge.
- Do exactly what each step says. If something is impossible or the plan looks wrong, stop and ask the owner.
- Everything in `corpus/` becomes public (GitHub and `frontend/public/corpus/`). Only add text that is open-licensed (CC BY, CC BY-SA, CC0, public domain) or written for this project. No images taken from Wikipedia or film sites (posters are not open-licensed).
- Never put `evals/corpus/acme-travel-policy.md` or `evals/corpus/zephyr-router-manual.md` in `corpus/`. They are eval fixtures, and the Acme one contains a planted prompt injection on purpose.
- Before finishing each step: `make lint` and `make test`. End with a report: files changed, how to verify, anything unsure.

## Decisions (already made, do not re-decide)

- Formats: Markdown for Wikipedia articles and project-written text; PDF for the real report and 2 fictional RAG.co documents. No `.txt`.
- Corpus layout uses subfolders (one folder = one shelf). Lowercase kebab-case names, no spaces (links are not URL-encoded). About 62 documents:

  ```
  corpus/
    README.md
    about-kenneth/         personal.md, experience-and-projects.md, faq-about-kenneth.md
    this-project/          how-this-office-works.md, design-decisions.md, site-faq.md, build-log.md
    places-and-interests/  sydney.md, batam.md, singapore.md, unsw.md, muay-thai.md,
                           mixed-martial-arts.md, ufc.md
    movies-and-games/      blade-runner-2049.md, the-social-network.md, ex-machina.md, resident-evil.md,
                           batman-arkham.md, cyberpunk-2077.md, the-last-of-us.md, watch-dogs.md
    rag-basics/            retrieval-augmented-generation.md, information-retrieval.md, vector-database.md,
                           semantic-search.md, full-text-search.md, learning-to-rank.md
    how-ai-works/          artificial-intelligence.md, machine-learning.md, neural-network.md, transformer.md,
                           generative-pre-trained-transformer.md, large-language-model.md, word-embedding.md,
                           ai-hallucination.md, prompt-engineering.md
    ai-history/            history-of-ai.md, dartmouth-workshop.md, turing-test.md, alan-turing.md,
                           ai-winter.md, deep-blue.md, alphago.md, chatgpt.md
    ai-and-society/        ethics-of-ai.md, algorithmic-bias.md, technological-unemployment.md, deepfake.md,
                           regulation-of-ai.md, environmental-impact-of-ai.md, existential-risk-from-ai.md
    general/               chess.md, go-game.md, apollo-11.md, great-barrier-reef.md
    real-reports/          nist-ai-rmf-1-0.pdf (only if the owner approves it in L6)
    lore/                  about-rag-co.md, staff-handbook.pdf, query-desk-terms.pdf,
                           coffee-club-terms.md, newsletter-october-2026.md, meeting-minutes.md
  ```

- Size caps: Wikipedia articles trimmed to at most 3,000 words (the `movies-and-games/` articles to at most 800, see L4); PDFs at most 40 pages. Target: the whole library under 700 chunks.
- Kenneth's CV is NOT added (it is a work in progress). His phone number never appears anywhere in `corpus/`.
- Keep from today's corpus: `retrieval-augmented-generation.md`, `information-retrieval.md`, `vector-database.md` (to `rag-basics/`), `large-language-model.md` (to `how-ai-works/`, re-fetched and trimmed in L3) and `cyberpunk-2077.md` (to `movies-and-games/`, re-fetched and trimmed in L4).
- Scrap from the live library (move to `evals/corpus/`, so `make eval` still uses them): `android.pdf`, `apple-inc.md`, `apple-silicon.md`, `iphone.md`, `macbook-pro.md`, `microsoft.md`, `samsung-galaxy.md`, `search-engine.md`, `star-wars.md`, `star-wars-film.md`, `the-empire-strikes-back.md`, `cyberpunk.md`.
- The fictional company is **RAG.co**. Its documents never mention the seven characters (Clerk, Chopper, Translator, Archivist, Scout, Judge, Storyteller) and never describe how the pipeline works; the `this-project/` shelf is the only source for that. Every RAG.co document says at the top: "Fictional. Part of the RAG.co story in this app, not real terms, people or events."
- Unanswerable topics for the "nothing found" evals: cooking recipes, football results, stock prices, today's weather. No document may cover them.
- PDF highlighting uses `react-pdf` at exactly `9.2.1` (pdf.js text layer). A new ADR 005 records it, since ADR 002 left PDF highlighting out of v1.

## Wikipedia fetching recipe (used by steps L3 and L4)

Write a one-off script in the scratchpad (do not commit it). For each article:

1. `GET https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=extracts|revisions&rvprop=ids&explaintext=1&redirects=1&titles=<Title>`.
2. Convert headings: `== X ==` to `## X`, `=== X ===` to `### X`, deeper levels to `### X`.
3. Drop these sections and everything under them: See also, References, Notes, Citations, Sources, Bibliography, Further reading, External links, Footnotes.
4. Trim: keep the lead and then whole sections in order until the next section would pass 3,000 words.
5. Write the file with exactly this header (same as the existing files), using the title the API returns after redirects:

   ```
   # <Article title>

   > Source: [https://en.wikipedia.org/wiki/<Title_with_underscores>](https://en.wikipedia.org/wiki/<Title_with_underscores>) (revision <revid>). Text available under CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
   ```

6. Add a row to the right table in `corpus/README.md`.

If a title does not resolve, stop and report it rather than picking another article.

## Steps

### L1. Prove subfolders work

- File: `backend/tests/test_seed.py`.
- Add a test: a temp corpus with `sub/note.md` (unique text) and a top-level file; after `seed(...)`, the results dict has the key `"sub/note.md"`, the stored `documents.filename` is `sub/note.md`, and the file was copied to `<public_dir>/sub/note.md`. Also check a `sub/README.md` is skipped.
- No production code changes expected. If the test fails, stop and report.

### L2. Restructure the corpus (moves only)

- `git mv` `retrieval-augmented-generation.md`, `information-retrieval.md` and `vector-database.md` into `corpus/rag-basics/`, `large-language-model.md` into `corpus/how-ai-works/`, and `cyberpunk-2077.md` into `corpus/movies-and-games/`.
- `git mv` the 12 scrapped files into `evals/corpus/`.
- Delete the stale copies in `frontend/public/corpus/` for every moved file only if they are tracked in git; check with `git ls-files frontend/public/corpus`.
- `evals/questions.jsonl`: the 5 kept files' `expected_file`/`expected_files` values get their new folder prefix. Scrapped files keep their names (fixtures are seeded from the `evals/corpus/` root).
- `corpus/README.md`: rewrite as one table per folder (file, source, licence). Move the scrapped rows into a new `evals/corpus/README.md` table.
- Replace the Apple example questions on the Ask page. `grep -rn -i "apple\|star wars\|cyberpunk\|samsung\|android\|microsoft" frontend/app frontend/components frontend/lib` and replace every example question with these four:
  - "What is retrieval-augmented generation?"
  - "Where did Kenneth grow up?"
  - "How does the Judge pick the best sources?"
  - "What does the RAG.co staff handbook say about lunch breaks?"
  Update the matching tests.
- `make test` must pass. Then run `make eval` and report the numbers (they can move; do not update `evals/baseline.json`).

### L3. Wikipedia: the AI shelves

Use the recipe for each article below (Wikipedia title, then file).

- `rag-basics/`: Semantic search (`semantic-search.md`), Full-text search (`full-text-search.md`), Learning to rank (`learning-to-rank.md`).
- `how-ai-works/`: Artificial intelligence (`artificial-intelligence.md`), Machine learning (`machine-learning.md`), Neural network (machine learning) (`neural-network.md`), Transformer (deep learning architecture) (`transformer.md`), Generative pre-trained transformer (`generative-pre-trained-transformer.md`), Large language model (overwrite `large-language-model.md`), Word embedding (`word-embedding.md`), Hallucination (artificial intelligence) (`ai-hallucination.md`), Prompt engineering (`prompt-engineering.md`).
- `ai-history/`: History of artificial intelligence (`history-of-ai.md`), Dartmouth workshop (`dartmouth-workshop.md`), Turing test (`turing-test.md`), Alan Turing (`alan-turing.md`), AI winter (`ai-winter.md`), Deep Blue (chess computer) (`deep-blue.md`), AlphaGo (`alphago.md`), ChatGPT (`chatgpt.md`).
- `ai-and-society/`: Ethics of artificial intelligence (`ethics-of-ai.md`), Algorithmic bias (`algorithmic-bias.md`), Technological unemployment (`technological-unemployment.md`), Deepfake (`deepfake.md`), Regulation of artificial intelligence (`regulation-of-ai.md`), Environmental impact of artificial intelligence (`environmental-impact-of-ai.md`), Existential risk from artificial intelligence (`existential-risk-from-ai.md`).
- Add 10 eval questions spread over the four folders (at least 2 per folder), `type: answerable`, with `expected_file` and an `expected_keyword` taken from the text.

### L4. Wikipedia: places, interests, movies and games, general

- `places-and-interests/`: Sydney (`sydney.md`), Batam (`batam.md`), Singapore (`singapore.md`), University of New South Wales (`unsw.md`), Muay Thai (`muay-thai.md`), Mixed martial arts (`mixed-martial-arts.md`), Ultimate Fighting Championship (`ufc.md`).
- `movies-and-games/`: Blade Runner 2049 (`blade-runner-2049.md`), The Social Network (`the-social-network.md`), Ex Machina (film) (`ex-machina.md`), Resident Evil (`resident-evil.md`, the franchise article), Batman: Arkham (`batman-arkham.md`, the series article), Cyberpunk 2077 (overwrite `cyberpunk-2077.md`), The Last of Us (franchise) (`the-last-of-us.md`), Watch Dogs (`watch-dogs.md`). Text only, no posters or cover art. If a franchise or series title does not resolve, use the first game's article and say so in the report. These 8 are kept brief, overriding the 3,000-word cap: keep only the lead (the article's opening summary, which has the key facts such as year, director or developer, genre and platforms) and at most one more section, the first of Plot, Premise, Synopsis, Setting, Gameplay or Overview that exists, cut at whole paragraphs so the file is at most 800 words.
- `general/`: Chess (`chess.md`), Go (game) (`go-game.md`), Apollo 11 (`apollo-11.md`), Great Barrier Reef (`great-barrier-reef.md`).
- Add cross-document eval questions with `expected_files` listing both files:
  - "What country is the city where Kenneth grew up in?" (`about-kenneth/personal.md`, `places-and-interests/batam.md`)
  - "When was the university Kenneth studied at founded?" (`about-kenneth/personal.md`, `places-and-interests/unsw.md`)
  - "Who directed Kenneth's favourite movie about Facebook?" (`about-kenneth/personal.md`, `movies-and-games/the-social-network.md`)
  - "Which of Kenneth's favourite games is about hacking?" (`about-kenneth/personal.md`, `movies-and-games/watch-dogs.md`)
  - "Which world chess champion lost to Deep Blue?" (`general/chess.md`, `ai-history/deep-blue.md`)
- Add 4 answerable single-document questions (one each for movies, games, places, general).
- Report how the cross-document questions score; they test multi-hop retrieval (PLAN step 7.1) and are expected to be hard.

### L5. This project's own documents

- Write 4 Markdown files in `corpus/this-project/`, each 600 to 1,500 words, `#` title, `##` per topic, written in plain words for non-technical visitors and in the third person ("the Judge…", "Kenneth built…").
  - `how-this-office-works.md`: one `##` per character (Clerk, Chopper, Translator, Archivist, Scout, Judge, Storyteller): what it does in plain words, then the real setting. Take every number and model name from the code, not from memory: `backend/app/about.py`, `backend/app/pipeline/*.py`, `backend/app/ask.py`. Include the "nothing found" ending and the vector map.
  - `design-decisions.md`: one `##` per decision, condensed from `docs/adr/001` to `004` and the owner's skips in `PLAN.md` (Fact-Checker dropped, why texts stay private, why GSAP).
  - `site-faq.md`: `## Question?` headings: Where does my pasted text go? Is it stored? What does it cost to run? What are the limits? Which AI models does it use? Can I run my own copy? Who built it? Where is the code? Use the stack and links in `README.md`; do not invent limits that are not in the code yet (say "planned" for step 6.1 limits).
  - `build-log.md`: 6 to 8 `##` lessons from building the project, each with what happened and what Kenneth learned, taken only from `PLAN.md` (skipped and moved steps), `docs/adr/`, and `git log --oneline`: building in small reviewed steps with Claude Code, switching from Figma and Rive to GSAP, dropping the Fact-Checker to ship, adding hybrid search and the Judge, the eval suite, the vector map. Mark it "Draft for Kenneth to review" in the PR description; Kenneth edits it before merge.
- Add 4 eval questions, one per file.

### L6. Real open-licensed PDFs

- Candidate (the Australian Voluntary AI Safety Standard was dropped by the owner). For each, open the official page, confirm the licence in writing in the report, and list the URL. Ask the owner to approve the list before downloading anything.
  1. NIST AI Risk Management Framework 1.0 (NIST AI 100-1), `https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf`. US federal work, public domain. File: `real-reports/nist-ai-rmf-1-0.pdf`.
- Reject a PDF if it is scanned, over 40 pages, or its text comes out garbled: check with `cd backend && .venv/bin/python -c "from pathlib import Path; from app.pipeline.collector import collect; p=collect(Path('../corpus/real-reports/<file>')); print(len(p)); print(p[0].text[:800])"`.
- Add each PDF's source, licence and attribution to `corpus/README.md`. Add 2 eval questions per PDF, at least one whose answer is on a page after page 5.

### L7. RAG.co, the fictional company

First write the lore sheet `corpus-drafts/lore/lore.md` (not seeded, not in `corpus/`). Every RAG.co document must agree with it:

- RAG.co is a small fictional company that "looks it up, then writes it down". Founded 4 October 2026, the day this project started, at a single desk.
- The office: Level 3, 12 Index Lane, in the fictional Card Catalogue District (not a real address). Rooms: the Query Desk (front counter), the Reading Room, the Mail Room, the Map Room, the Kitchen, and the Archive on Level 2.
- Opening hours: the Query Desk opens whenever a question arrives; after a quiet spell the building "goes to sleep" and takes up to a minute to wake.
- The rival across the street: Guesswork & Co., which answers without looking anything up. Motto: "Sounds about right."
- The sign: "Days since last hallucination: 0". It has read 0 since it was hung, because Guesswork & Co. installed the counter as a housewarming joke, and RAG.co kept it as a reminder.
- The office cat: Meow, who sleeps on the Archive's warm shelves.
- The Coffee Club: members-only coffee from the Kitchen machine "Bean There".
- No characters from the app appear. Staff are only "staff", "members" or job titles (office manager, facilities team).

Then write, each 600 to 2,500 words, with specific, checkable details (times, dates, numbers, clause numbers) and no instructions aimed at AI models:

- `corpus/lore/about-rag-co.md`: the company's history and the office (from the lore sheet), the rivalry, the sign, the cat.
- `corpus-drafts/lore/staff-handbook.md` rendered to `corpus/lore/staff-handbook.pdf` (6 to 10 pages): working hours, lunch breaks, the Kitchen rules, dress code, leave, fire drills, visitors, the Archive's quiet rules, what to do when the building goes to sleep.
- `corpus-drafts/lore/query-desk-terms.md` rendered to `corpus/lore/query-desk-terms.pdf` (4 to 6 pages), "Terms and Conditions of the RAG.co Query Desk", numbered clauses with sub-clauses: 1 Definitions (Question, Card, Shelf, Citation); 2 Opening hours (up to a minute to wake); 3 Your question (under 1,000 characters); 4 No-guessing guarantee (every claim pinned to a card; unpinned claims void); 5 Nothing-found clause (if the shelves do not cover it, RAG.co says so and never borrows an answer from Guesswork & Co.); 6 Selection (at most 5 cards cited, chosen from 20); 7 Your own papers (pasted texts stay in your folder and are never filed in the shared cabinet); 8 Out-of-scope subjects (for example cooking recipes, football results); 9 Liability; 10 Changes to these terms (decided at the monthly meeting, see the minutes). Clauses 2, 3, 4, 6 and 7 must match the real app: check the numbers in `backend/app/ask.py`, `backend/app/pipeline/scout.py` and `backend/app/pipeline/judge.py` and ADR 002.
- `corpus/lore/coffee-club-terms.md`: the Coffee Club membership terms, numbered clauses (fees, the 2-cup daily limit, cancellation, the Meow clause).
- `corpus/lore/newsletter-october-2026.md`: company news only (opening month, the sign, a Kitchen upgrade, a Guesswork & Co. sighting, upcoming events with dates).
- `corpus/lore/meeting-minutes.md`: minutes of 3 monthly meetings (dates, attendees by job title, decisions such as approving the Coffee Club fee and changing a Query Desk clause).
- Render each PDF: `pandoc corpus-drafts/lore/<name>.md -s -o /tmp/<name>.html --metadata title="<Title>"`, then `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --no-pdf-header-footer --print-to-pdf=corpus/lore/<name>.pdf /tmp/<name>.html`. Check each with the `collect` command from L6.
- Check: `grep -rniE "clerk|chopper|translator|archivist|scout|judge|storyteller" corpus/lore corpus-drafts/lore` prints nothing.
- Add 6 eval questions (one per document), at least one about a fact after page 3 of the handbook, plus 1 unanswerable one about Guesswork & Co.'s opening hours (not in any document).

### L8. Kenneth's documents (after the owner signs off the drafts)

- Only when the owner says the drafts are final: `git mv corpus-drafts/about-me/*.md corpus/about-kenneth/`.
- Check: `grep -rnE "\+61|\b04[0-9]{2} ?[0-9]{3}" corpus/` returns nothing (no phone number).
- Add 8 eval questions about Kenneth (where he grew up, degree, AWS certification, Whysper, Catchup, the Atlassian project, roles he wants, his favourite movies and games, how to see his CV) and 1 unanswerable one about him (for example his salary expectations).
- Add 4 unanswerable questions, one per topic in the decisions (cooking recipes, football results, stock prices, today's weather).

### L9. Reseed locally and save the baseline

- Reset the local database so old placeholder rows go: `docker compose down -v && docker compose up -d db`, wait 5 seconds, then `make migrate && make seed`.
- `make eval`, then save the new baseline as `make eval` documents.
- Report the chunk count from `Mapped N chunks` (target under 700) and check the File cabinet and the vector map at http://localhost:3000.
- `corpus-drafts/` keeps only the RAG.co lore sheet and PDF sources; it is never seeded.
- Do NOT seed Supabase. That is PLAN step 6.0a, done by the owner.

### L10. Download button in the viewer

- `frontend/components/viewer/LibraryDocView.tsx`: next to "Open the original", add `<a href={`/corpus/${doc.filename}`} download>Download</a>` (no `#page`).
- `frontend/components/viewer/PrivateTextView.tsx`: a "Download" button that saves the pasted text as `<title>.txt` using a `Blob` and an object URL (revoke it after the click). Title cut to 60 characters, non-alphanumeric characters replaced by `-`.
- Tests: the library link has the `download` attribute and the right `href`; the private button creates a Blob with the text (mock `URL.createObjectURL`).

### L11. Highlight the cited passage inside PDFs

- Write `docs/adr/005-pdf-highlighting.md` (context: ADR 002 left it out of v1; decision: `react-pdf@9.2.1` with the pdf.js text layer; consequences: bigger bundle, loaded only when a PDF is viewed).
- `npm install --save-exact react-pdf@9.2.1` in `frontend/`.
- New `frontend/components/viewer/PdfPageView.tsx` (client component, loaded with `next/dynamic` and `ssr: false`): renders the cited page of `/corpus/<filename>` with `<Document>` and `<Page pageNumber={page} renderTextLayer>`; set `pdfjs.GlobalWorkerOptions.workerSrc` to `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()`; import `react-pdf/dist/Page/TextLayer.css`.
- Highlighting: pass `customTextRenderer={({ str }) => ...}` that wraps `str` in `<mark>` when the whitespace-normalised, lower-cased `str` (at least 4 characters) appears in the whitespace-normalised, lower-cased cited chunk text. Scroll the first `<mark>` into view.
- `LibraryDocView.tsx`: for a PDF with a cited chunk that has a page, show `PdfPageView` above the extracted text, with "Previous page" and "Next page" buttons. Keep the extracted-text view and its highlight as the fallback when the PDF fails to load.
- Tests: mock `react-pdf`; check the right page number is requested and that the text renderer marks text from the cited chunk and leaves other text alone.
- Check by hand: ask a question answered by the RAG.co staff handbook PDF, open the citation, see the passage marked on the right page.

## Verification (after all steps)

```bash
make lint
```

```bash
make test
```

```bash
make eval
```

```bash
grep -rnE "\+61|\b04[0-9]{2} ?[0-9]{3}" corpus/ frontend/public/corpus/
```

The last command must print nothing. Then on http://localhost:3000: the File cabinet lists only the new library (about 62 documents), the map shows clear clusters, every example question on the Ask page gets a cited answer, Download works for a library document and a pasted text, and a PDF citation shows the passage marked on its page.

## Reminders for the owner (not for the agent)

These are now PLAN.md steps: 2.10 (spend limit), 6.0a (Supabase `make migrate` and `make seed`, remove the placeholder rows), 6.2a and 6.2b (rename to ragvisualised).
