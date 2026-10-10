# PLAN

Source of truth for the build. Work the first unticked step only. Background, architecture, stack and characters: [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md).

Steps marked **(You)** are done by hand, outside Claude Code. Every other step is one `/next-step` cycle, one commit, one PR that the owner reviews and merges.

Design rule: keep every piece a real RAG system needs (parse, chunk, embed, vector + keyword search, rerank, cited answers, evals, tracing) and nothing else. Free tiers wherever possible; the only paid service is the live site's LLM (expected: Claude Haiku), capped by a spend limit; development uses a free Gemini model (ADR 003).

## Phase 0: Repo and Claude Code setup

- [x] 0.1 (You) Repo
  - Do: public GitHub repo with README, MIT license, Python + Node `.gitignore`; clone it; install `gh` and log in.
  - Done when: the repo is visible when logged out.
- [x] 0.2 (You) Claude Code setup
  - Do: add `CLAUDE.md`, `PLAN.md` and the two step skills; push.
  - Done when: `/next-step` appears in Claude Code.
- [x] 0.3 (You) Repo protections
  - Do: turn on secret scanning and push protection; protect `main` (require a PR, block force pushes). Required status checks are added in 1.5, once CI exists.
  - Done when: a direct push to `main` is rejected.
- [x] 0.4 Folder layout
  - Do: create `frontend/`, `backend/app/pipeline/`, `evals/`, `docs/adr/`, `corpus/`; add `.env.example` listing every variable with fake values.
  - Done when: folders exist and `.env` is git-ignored.
  - Out of scope: any application code, `CONTRIBUTING.md`, templates.
- [x] 0.5 Contributing guide
  - Do: add a short `CONTRIBUTING.md` (how to run it, how to open a PR, the PLAN-driven workflow).
  - Done when: the file exists and is linked from the README.
  - Out of scope: code of conduct, issue and PR templates, CI, application code.
- [x] 0.6 ADR for the stack
  - Do: write `docs/adr/001-stack.md`: the stack and why each piece was chosen, and what was left out on purpose (a Storage bucket for original files, Docker images for the apps, Sentry, an ORM or migration framework, end-to-end browser tests). Record these decisions: plain `.sql` migration files applied by a small script; the original upload is not kept, only its chunks; embedding vectors are 1024 dimensions; Render deploys with its native Python runtime.
  - Done when: the owner agrees with every reason in it.
  - Out of scope: other ADRs, any code.
- [x] 0.7 ADR for owner-curated library and private pasted text
  - Do: write `docs/adr/002-owner-curated-library.md`. Record: the shared library is owner-curated and read-only at runtime (only `make seed` writes it, and the Collector is used only there); visitors paste text instead of uploading files, with a title and a 20,000-character limit, so the backend never parses a visitor's file; a visitor's pasted text is private: the backend chunks and embeds it, returns the chunks and vectors to the browser and stores nothing; the browser keeps the text, chunks and vectors, and sends the chunks with each question; a citation to a visitor's own text highlights the exact passage in the browser; at runtime the backend writes only the `usage` table. Record the rejected options (file uploads of a few MB, per-session database rows with expiry, re-embedding on every question, no database at all) and the costs (no PDF upload and no page numbers for private text, text lost when the tab closes unless kept in IndexedDB, text still reaches Voyage and Anthropic). Also reword one line in `docs/adr/001-stack.md`: the server does not keep the original upload, only its chunks.
  - Done when: the owner agrees with every reason in it.
  - Out of scope: other ADRs, any code, changes to PLAN.md.

## Phase 1: Walking skeleton and CI/CD

Deploy an almost-empty app first, so every later step ships through a working pipeline.

- [x] 1.1 Backend skeleton
  - Do: FastAPI app in `backend/` with `GET /health`, one pytest test, Ruff config, `requirements.txt`.
  - Done when: `pytest` passes and `/health` returns ok locally.
  - Out of scope: database, Makefile, CI, Docker.
- [x] 1.2 Frontend skeleton
  - Do: Next.js app in `frontend/` with a shared nav and two empty pages, `/upload` and `/ask`; one Vitest test.
  - Done when: both pages load locally.
  - Out of scope: backend calls, styling beyond the basics, Makefile, CI.
- [x] 1.3 Local database
  - Do: `docker-compose.yml` with one service: Postgres using the `pgvector/pgvector:pg16` image, port and credentials matching `.env.example`.
  - Done when: `docker compose up` starts a database where `CREATE EXTENSION vector;` succeeds.
  - Out of scope: migrations, schema, containers for the apps, deployment config.
- [x] 1.4 Makefile and formatter hook
  - Do: `Makefile` with `format`, `lint`, `test` targets for both apps; add the PostToolUse `make format` hook to `.claude/settings.json`.
  - Done when: `make lint` and `make test` pass and editing a file reformats it.
  - Out of scope: CI, new tests.
- [x] 1.5 CI
  - Do: GitHub Actions `ci.yml`: lint and tests for both apps on every PR, plus `tsc` for the frontend and a `pgvector/pgvector:pg16` service container for later database tests. Then mark the CI job as a required check on `main`.
  - Done when: this step's PR shows green checks.
  - Out of scope: Python type checking, eval workflow, deploys.
- [x] 1.6 (You) Hosting
  - Do: connect `frontend/` to Vercel; create one Supabase project (free) and enable the `vector` extension; deploy `backend/` to Render's free web service with the native Python runtime (build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`) with env vars set.
  - Done when: Vercel posts a preview URL on PRs and live `/health` works.
- [x] 1.7 Health badge
  - Do: frontend shows a "library online" badge from the backend's `/health`; backend URL comes from an env var.
  - Done when: the badge is green on the live site.
  - Out of scope: any other backend endpoint.
- [x] 1.8 (You) Context7 MCP
  - Do: add the Context7 MCP at project scope (`.mcp.json`).
  - Done when: `/mcp` lists it.

## Phase 2: Central library and the Upload page

The shared library is owner-curated and read-only at runtime: only `make seed` writes to it. A visitor's pasted text is private: the backend chunks and embeds it, returns the result to the browser, and nothing is stored server-side (ADR 002). Visitors paste text instead of uploading files. Tests never call paid APIs: they use a fake embedder.

- [x] 2.1 Migrations
  - Do: plain `.sql` files in `backend/migrations/` and a small `backend/app/migrate.py` (psycopg) that applies unapplied files in order and records them; `make migrate`. Tables: `documents` (title, filename, content hash, uploaded at) and `chunks` (document ID, position, page, heading, text, `embedding vector(1024)`, full-text column with a GIN index, and an HNSW index on the embedding).
  - Done when: `make migrate` works against the local database and runs in CI against the service container.
  - Out of scope: any code that reads or writes the tables.
- [x] 2.2 Collector
  - Do: parse PDF, Markdown and text into text with page numbers; tests with small fixture files. Used by the seed script only; visitors paste text.
  - Done when: tests pass on all three file types.
  - Out of scope: chunking, embeddings, database writes, endpoints.
- [x] 2.3 Chopper
  - Do: split parsed text into ~500-token chunks with a 50-token overlap, keeping page and heading.
  - Done when: unit tests cover empty input, one huge section and a code block.
  - Out of scope: embeddings, database writes.
- [x] 2.4 Translator
  - Do: Voyage embedding client (voyage-4, `output_dimension=1024`) with batching and retries, plus a fake embedder for tests; key from env.
  - Done when: a real call works locally once and tests use the fake.
  - Out of scope: database writes, endpoints, reranking.
- [x] 2.5 Archivist
  - Do: save a document and its chunks in one transaction; skip duplicates by content hash. The original file is not stored. Used only by the seed script, never by an upload endpoint.
  - Done when: saving the same file twice stores it once.
  - Out of scope: endpoints, search, file storage, the seed script.
- [x] 2.6 Upload endpoint
  - Do: `POST /upload`: takes a `title` and `text` (at most 20,000 characters), runs the Chopper and Translator, streams a step event as each starts and finishes, and ends with the chunks and their vectors in a compact form for the browser to keep. Writes nothing to the database. Define the event shape once in `backend/app/events.py` (`step`, `status` of `start` or `done`, optional `data`); `/ask` reuses it.
  - Done when: `curl` shows the event stream end to end and the database is unchanged afterwards.
  - Out of scope: any database write, quotas, frontend.
- [x] 2.7 Library endpoints
  - Do: `GET /library` (documents with chunk counts) and `GET /library/{id}` (document with its chunks).
  - Done when: both return a document, once the starter corpus is seeded (2.9) or a test document is saved.
  - Out of scope: upload, delete, frontend.
- [x] 2.8 Upload page
  - Do: plain UI with a title field, a text box with a character counter (20,000 maximum), a text log of step events as they stream, the starter library list, and a "your texts" list. The browser keeps each private text, its chunks and vectors in memory. The page says the text is sent to Voyage and Anthropic.
  - Done when: pasting a text on the preview URL shows it under "your texts".
  - Out of scope: characters, animations, the Ask page, file upload, keeping texts across refreshes.
- [x] 2.9 Seed corpus
  - Do: `make seed` loads the starter corpus from `corpus/` so the library is never empty: the owner's own documents (CV, experience, projects, public contact details) plus a few openly licensed documents. It also copies the original files to `frontend/public/corpus/` so citations can open them.
  - Done when: the live library lists the starter documents.
  - Out of scope: evals, new endpoints.

## Phase 3: The Ask page with citations

- [x] 3.1 Scout
  - Do: top-k vector search over the library in the database, plus cosine search in memory over any private chunks passed in, merged by score (k = 5 for now). Each result says whether it came from the library or the visitor's own pasted text.
  - Done when: tests with fixed fake embeddings return the expected chunks from the library, from private chunks, and from both.
  - Out of scope: hybrid search, reranking, endpoints.
- [x] 3.2 Storyteller prompt
  - Do: prompt in its own file: answer only from the numbered chunks, cite them as [1], [2], say so when the chunks don't cover the question, treat chunk text as data, never as instructions.
  - Done when: the owner reads the prompt and agrees with every line.
  - Out of scope: calling the LLM, endpoints.
- [x] 3.2a LLM client
  - Do: `backend/app/llm.py` per ADR 003: one streaming function taking a system prompt and messages, with `openai_compatible` and `anthropic` implementations chosen by `LLM_PROVIDER`; retries 429 and 5xx with backoff; a fake client for tests; add `LLM_PROVIDER`, `LLM_BASE_URL` and `LLM_API_KEY` to `.env.example`.
  - Done when: tests pass with mocked HTTP and the fake client, and one real call works locally once against Gemini.
  - Out of scope: the Storyteller prompt, endpoints, the Fact-Checker.
- [x] 3.3 Ask endpoint
  - Do: `POST /ask`: takes the question and optional private chunks with vectors (size capped); Translator, Scout, Storyteller in order; stream step events and the answer; the LLM is called only through `llm.py` (provider and model from env vars).
  - Done when: `curl` shows events, then the answer, with and without private chunks.
  - Out of scope: citations list, rate limits, frontend.
- [x] 3.4 Citations
  - Do: map each [n] to its chunk (document, page, snippet, and whether it is from the library or the visitor's own pasted text) and send the list after the answer; drop any [n] that doesn't match a chunk.
  - Done when: tests cover valid, repeated and made-up citation numbers.
  - Out of scope: frontend.
- [x] 3.5 Ask page
  - Do: plain UI with a question box, streamed answer, [n] markers as buttons, and a sources panel showing each cited snippet. Sends the visitor's private chunks with each question.
  - Done when: on the preview URL, every marker opens its source.
  - Out of scope: document view page, characters.
- [x] 3.6 Document view
  - Do: page `/library/[id]` that scrolls to and highlights the cited chunk when opened from a citation. For a citation to a visitor's own pasted text, show that text from the browser with the cited passage scrolled to and highlighted. Library citations link to the original in `/corpus/` at the cited page.
  - Done when: clicking [2] lands on the cited passage or page, for a library document and for a pasted text.
  - Out of scope: editing or deleting documents, highlighting the exact passage inside a PDF.
- [x] 3.7 Starter evals
  - Do: 30 questions in `evals/questions.jsonl` (at least 8 about the owner's documents, 5 the library can't answer, 2 aimed at a planted instruction inside a corpus file) and `make eval`, run against a fresh database holding only the starter corpus, reporting retrieval hit rate, citation validity and refusals.
  - Done when: `make eval` prints a score table that is saved as the baseline.
  - Out of scope: LLM-judged metrics, CI workflow.
- [x] 3.8 Bigger corpus and harder evals
  - Do: add about 10 more documents to `corpus/` that compete with the first six (other phones and companies, search and LLM topics, a real PDF, Star Wars and Cyberpunk 2077 topics); add an eval-only fictional product manual in `evals/corpus/`; add about 20 harder questions (paraphrases, near-miss topics, needle-in-a-long-document, exact codes, multi-document, near-miss refusals) and report the hard questions' retrieval hit rate separately; save a new baseline.
  - Done when: `make eval` scores below 100% on the hard questions, so Phase 4 upgrades can show an improvement.
  - Out of scope: the owner's own documents, evals with private pasted text, LLM-judged metrics.

## Phase 4: Industry extras

Each upgrade has eval scores before and after, pasted into the PR description.

- [x] 4.1 Hybrid search
  - Do, in this order:
    1. Add 5 eval questions built on exact names or codes to `evals/questions.jsonl`, then run `make eval` on the current vector-only Scout. This is the "before" score; save it for the PR.
    2. Add keyword search over the library using the existing `chunks.fts` column and `chunks_fts_idx` (no migration): build an OR query from the question's words (`to_tsquery('english', ...)` with the stemmed terms joined by `|`, words sanitised so user text can't break the query) and rank with `ts_rank_cd`. Plain `plainto_tsquery` is not used because it ANDs every word and returns nothing for natural questions.
    3. Fetch the top 20 from each list. Private chunks are cosine-scored in memory and join the vector list (merged with the library's vector hits by cosine score); they have no keyword rank. Fuse the vector list and the keyword list with reciprocal rank fusion, `1/(60 + rank)` summed per chunk, and keep the top k (5).
    4. Extend `Result` with `vector_rank`, `vector_score`, `keyword_rank` and `keyword_score` (each optional) and keep `score` as the fused RRF score. `ask.py` keeps sending `score`.
    5. Run `make eval` again for the "after" score.
  - Done when: before and after eval scores are in the PR, and tests cover a chunk found only by keyword, one found only by vector, one found by both, and private chunks outranking nothing unfairly (they compete by vector rank, not raw score).
  - Out of scope: reranking, new migrations, frontend.
- [x] 4.2 Judge
  - Do: Scout returns its top 20 (fused order) instead of 5. A new `backend/app/pipeline/judge.py` reranks them with Voyage `rerank-3-lite` (using `VOYAGE_API_KEY`, retries like the Translator's embedder) and keeps the best 5. Private chunks are part of the same 20-candidate pool and are reranked with the library chunks. Add a fake reranker for tests. Each result gets `old_rank`, `new_rank` and `rerank_score`; the Judge's `done` event lists all 20 with those fields and says which 5 were kept. If the reranker call fails after retries, the Judge falls back to the first 5 in the fused order and marks `"fallback": true` in its event; the question still gets answered. `/ask` runs Translator, Scout, Judge, Storyteller. Citations and the Storyteller only ever see the kept 5.
  - Done when: before and after eval scores are in the PR (the "before" is the 4.1 "after"), and tests cover reordering, private chunks in the pool, and the fallback.
  - Out of scope: Fact-Checker, frontend.
- [~] 4.3 Fact-Checker (SKIPPED for now by the owner; not needed for v1, revisit later) (character dropped by the owner)
  - Do: one LLM call through `llm.py` checks each cited claim against its chunk and flags unsupported ones, as a reusable function; off by default, behind a toggle.
  - Done when: a planted wrong claim gets flagged.
  - Out of scope: frontend display beyond the toggle, LLM-judged evals.
- [~] 4.4 LLM-judged evals (SKIPPED for now by the owner; depended on 4.3)
  - Do: faithfulness (reusing the Fact-Checker function) and answer correctness scored by the LLM through `llm.py`, added to `make eval`.
  - Done when: scores look sensible on 3 answers the owner grades.
  - Out of scope: CI workflow.
- [~] 4.5 Evals in CI (SKIPPED for now by the owner; evals are run locally before pushing)
  - Do: `evals.yml` runs on PRs that touch the pipeline or prompts, posts scores as a PR comment, fails when the retrieval hit rate or citation validity drops more than 5 points below baseline, skips when secrets are missing (forks). Only these retrieval and citation scores are checked: no LLM-judged scores exist, since 4.3 and 4.4 are skipped.
  - Done when: a PR with a deliberately bad prompt fails.
  - Out of scope: new eval questions.
- [~] 4.6 Tracing (SKIPPED for now by the owner; revisit later)
  - Do: send every upload and question to Langfuse with a span per character (inputs, outputs, time, tokens, cost).
  - Done when: one trace shows all steps of a question.
  - Out of scope: error monitoring.
- [x] 4.7 Dependabot
  - Do: one `.github/dependabot.yml` covering pip, npm and GitHub Actions.
  - Done when: Dependabot shows as enabled in the repo's security tab.
  - Out of scope: CodeQL, release automation, application code.
- [x] 4.8 Visual data in step events
  - Do: make the step events carry the real data the characters will show (see "What each character shows on screen" in `docs/PROJECT_BRIEF.md`): the Chopper's `done` event lists each chunk's position, heading, length in characters and the length of the overlap it shares with the previous chunk; the Translator's `done` event for a question lists each word of the question with an influence weight (leave-one-out: embed the question once with every word removed in turn, in one batch, and use how far the vector moves, scaled 0 to 1); the Scout's `done` event gives each result its vector rank and score, its keyword rank and score, and the words that matched (from the full-text search), and says which of the two lists found it. The question text is escaped, and no new endpoint is added.
  - Done when: tests with the fake embedder cover each new field, and `curl` shows them on a real question and a real upload.
  - Out of scope: the vector map (4.9), any frontend.
- [x] 4.8a Placeholder Ask scene
  - Do: frontend only, Ask page only, with no Figma or Rive art. A row of labelled placeholder boxes for the characters that exist (Translator, Scout, Judge, Storyteller; the Fact-Checker is skipped), with a mock library area beside them where the Archivist and Scout stand. The visitor types the question into a text bubble above the Translator; when the Translator's `done` event arrives, each word of the question is highlighted by its real influence weight (from 4.8). Each character's box shows its state (waiting, working, done) from the step events. The Storyteller's answer appears as a chat bubble above the Storyteller with its `[n]` markers as buttons; clicking the answer or a marker opens a simple sidebar listing the cited sources (the existing sources panel from step 3.5, moved into a side panel) with the cited snippet and the link to `/library/[id]`, and a close button. Keep all existing Ask behaviour (private texts sent with each question, errors, `[n]` markers) and keep the components easy to swap for real characters later.
  - Done when: on the preview URL, asking a question types it into the bubble, highlights its words, shows each character's state, shows the answer in the Storyteller's bubble, and clicking it opens the citations sidebar; component tests with fixed step events cover the highlight, the states and the sidebar.
  - Out of scope: the Upload page, Figma, Rive, animations, the vector map, the Judge's rank-change visual, the PDF viewer and next/previous buttons of step 5.12, new backend endpoints.
- [x] 4.9 Vector map data
  - Do: a new migration with `map_projection` (one row: the 1024-number mean and the two principal components) and `map_points` (chunk ID, x, y). `make seed` fits a 2-D PCA with numpy over all library chunk vectors, stores the projection and every chunk's point, and writes nothing else. `GET /map` returns the points (chunk ID, document ID, title, x, y). `/ask` adds the question's point, and `/upload` adds each new chunk's point, by projecting their vectors with the stored projection. Add `numpy` to `requirements.txt`.
  - Done when: tests with fixed vectors check the projection, and chunks of the same document land closer together than chunks of different documents in a seeded test library.
  - Out of scope: any frontend, 3-D, UMAP or t-SNE, re-projecting when a document is added without re-seeding.

## Phase 5: Office rooms and characters (design canvas and GSAP)

The design lives on the Claude Design canvas "Upload Page Workshop" (https://claude.ai/artifact/XkNNxKuaj5gfEvSfFhR15F): a warm, isometric 3-D office in browns, with IBM Plex Sans and Mono. How it reaches the code is in `docs/design/DESIGN_TO_CODE.md`. The cast is seven characters: the Clerk (greets the visitor on the Ask page and carries the question), the Chopper, the Translator and the Archivist (Upload), and the Scout, the Judge and the Storyteller (Ask). The Collector stays in the seed script and the Fact-Checker (4.3) is skipped, so neither has a character.

Step 5.1 builds the pages from the canvas and ports the animation in one go. Two test pages play today's scenes and are the reference for the rooms and the animation: `docs/design/gsap-spike/` (Upload office) and `docs/design/gsap-ask-spike/` (Ask office and Query room). Both offices show the canvas's zoom, `viewBox="150 0 1060 600"`.

Office animation convention (ADR 004; added to `CLAUDE.md` in step 5.1): each room is one SVG in `frontend/public/office/` (`upload-room.svg`, `ask-room.svg`, `query-room.svg`, and the static `break-room.svg`) with its characters, their carried props and every extra moving part in it, animated in code with `gsap` and `@gsap/react` (exact versions in ADR 004). Ids: moving room parts in kebab-case; each character a group named after it, drawn in an 80 by 120 box with its feet at (40, 116), with a `<p>-flip` group and every part prefixed `<p>-` (`cl`, `ch`, `tr`, `ar`, `sc`, `ju`, `st`); home spots `spot-<name>` and walk targets `spot-<name>-<place>`. Scenes live in `frontend/lib/office/scenes/<room>.ts` as a map from `<step>_<status>` to a function that builds a paused timeline (optional label `handoff`); `frontend/lib/office/sceneQueue.ts` plays them one at a time, starting the next at the `handoff` label or 1 second after the end. All text with real data stays in the DOM.

- [x] 5.0 (You) Final design on the canvas
  - Do: finish the pages, the rooms (Upload office, Ask office, Query room, the home page's break room) and the seven characters on the canvas; pull every canvas file into `docs/design/upload-page/project/` and commit it.
  - Done when: the files in git match the canvas.
- [x] 5.1 Office pages and animation (one PR; replaces the old steps 5.0a to 5.0f, 5.0h and 5.1 to 5.4)
  - Do: port the finished canvas design and the two tested GSAP pages (`docs/design/gsap-spike/`, `docs/design/gsap-ask-spike/`) into `frontend/`, driven by the real backend.
    - Look and tabs: IBM Plex Sans and Mono with `next/font/google`; the canvas's tokens in `globals.css` (page #E4D8C6, panel #F6EFE4, paper #FBF6EC, border #D2C1A8, ink #33261D, muted text #6A5848, accent #7A5236, dark tab #4A3426; status chips: waiting #E4E1D8 on #4A3426, working #EDE1B8 on #5A4A12, done #DCE3D6 on #2F4F2A); the header's segmented tabs "Home | Upload | Ask" (icon and label, 44px tall, links with `aria-current="page"`), keeping the "Backend online" badge.
    - Room art: flat static SVGs in `docs/design/office-svg/`, copied to `frontend/public/office/`: `upload-room.svg` from the Upload spike, `ask-room.svg` and `query-room.svg` from the Ask spike, and the static `break-room.svg` from the canvas, each with its characters, props, moving parts and `spot-*` markers named by the convention above (offices in `viewBox="150 0 1060 600"`). Home spots as percentages in `frontend/lib/office-spots.ts` (`left = (x - 150) / 10.6`, `top = y / 6`).
    - Player: add the convention above to `CLAUDE.md`; add `gsap` and `@gsap/react` at the exact versions in ADR 004. `frontend/lib/office/sceneQueue.ts` (plain TypeScript): one scene at a time in order, the next starts at the current scene's `handoff` label or 1 second after it ends, a character's "still working" loop stops when its next scene starts, events with no scene are ignored, `error` clears the queue and stops every loop, and reduced motion jumps each scene to its end state (still 1 second apart, no loops). `frontend/components/office/OfficeRoom.tsx` loads a room SVG from `/office/`, hides the `spot-*` markers, scopes GSAP with `useGSAP` and feeds the queue from one reducer in `frontend/lib/sceneState.ts`, which turns the real step events into scene events and into the speech bubbles' waiting, working, done and error.
    - Scenes, ported from the spikes with walk targets read from the spot markers: `frontend/lib/office/scenes/upload.ts` (Chopper, Translator, Archivist), `ask.ts` (the Clerk writes the question on the whiteboard and waits beside it, the Translator, Scout, Judge and Storyteller, the Clerk fetches the answer, and the "nothing found" ending) and `query.ts` (`clerk_away`, `clerk_back`, `clerk_shrug`).
    - Upload page: the Upload office with `OfficeRoom` and the three characters' `SpeechBubble`s; the Archivist has no backend step, so send `archivist_start` and `archivist_done` around `usePrivateTexts().add()`. When the Chopper's `done` gives the chunk count the bubble says so, and the counter above the file cabinets shows the real number of documents. The step log becomes a collapsible "What just happened" panel. The paste form becomes the canvas's interoffice envelope ("Interoffice mail · To: File cabinet", a title line, lined paper with the 20,000-character counter, the "Send to file cabinet" button whose accessible name stays "Add text", the privacy note), with "pick or drop a file" for `.md` and `.txt` read by `FileReader` (title from the file name, cut at 20,000 characters with a visible note; any other type gets a friendly error). The backend still only receives text (ADR 002).
    - Ask page: the "Query" panel with `query-room.svg` (the Clerk behind the counter, his greeting bubble and the question box) and the Ask office with `OfficeRoom` and the crew's bubbles, replacing the row from 4.8a. When the question is sent, `clerk_away` and `clerk_start` play; when the answer is done, `clerk_done` and then `clerk_back` (or `clerk_shrug` when nothing was found), so the Clerk is never in both rooms at once. Keep every existing Ask behaviour: private texts sent with each question, errors, the question's words highlighted by their real influence weights, the answer's `[n]` markers, the citations sidebar, the Scout's and Judge's details.
    - Library panel on both pages: the canvas's "File cabinet" with a "Documents | Map" switch. Documents lists the starter library by shelf (title, chunk count, link to `/library/[id]`, from `GET /library`) and the visitor's own texts under "Your books", each with a Remove button that deletes it from `usePrivateTexts`. Map shows a "coming soon" card until 5.0g.
    - Home page: `/` from the canvas's `WhyRag.dc.html` (replacing the redirect to `/upload`), in this order and nothing else: a hero (one-line heading, one sentence, buttons "Ask a question" to `/ask` and "Add your own text" to `/upload`); the break room with the Clerk's one-line bubble; "What is RAG?" (one paragraph, the three steps Find, Pick the best, Answer with sources, one line naming products that work this way, and one question answered with and without RAG side by side); "Why not just ask the model?" (the CBC News link about Air Canada's chatbot, three one-line points and one line on the catch); "How this one is built" (seven rows: question, one-line answer, link to the step that shows it, including the stack and the GitHub link); "About the creator" (a short bio, an "Ask the office about me" button that opens `/ask` with a question about the creator filled in, and at most four `<details>` questions). Keep the owner's placeholders visible until 6.0.
    - At phone width the bubbles stack under the rooms and no page scrolls sideways.
  - Done when: on localhost and the preview URL, one real upload plays the mail arriving, the Chopper, the Translator and the Archivist in order (the Translator starts as the card lands) and the text lands in the library panel; a good question plays the Clerk and the crew through every step and shows the answer and sidebar, and an unanswerable one plays the "nothing found" ending with the Clerk shrugging; with reduced motion on, each scene jumps to its end state; tests cover the tabs, the queue (order, handoff, the 1-second hold, loops, `error`, reduced motion) with fake timelines, every id each scene file uses existing in its room SVG, the reducer's states, the envelope's file reading, cap and wrong-type error, the library panel's switch and Remove, and the Home page's links and FAQ; existing tests pass, updated only where markup changed.
  - Out of scope: the vector map (5.0g), the data-driven scenes (5.8, 5.9), new backend endpoints.

- [x] 5.0g Vector map (moved up from 5.7a)
  - Do: a React component (canvas or SVG, no new charting library unless one is clearly needed) that draws the library's points from `GET /map`, coloured by document, with a legend, hover cards showing the chunk's title and heading, zoom and pan, and a text label saying the map is a flattened 2-D picture of the 1024-number vectors, so distances are approximate. It can show the visitor's own chunks as a separate coloured group, the question as a marker, and a set of highlighted points with lines from the question to them. It plays no character animation itself.
  - Done when: component tests with fixed points cover drawing, highlighting and hover, and the map shows the live library in the Map tab of the library panel (5.1) on both pages.
  - Out of scope: the scenes that use it (5.8, 5.9), 3-D.
Steps 5.5 to 5.7 (Figma characters, Figma layouts, per-character Rive) were removed by ADR 004.

- [~] 5.8 Full Upload scene (SKIPPED for now by the owner; moving straight to launch, revisit after v1.0.0)
  - Do: the data-driven parts of the Upload scenes in `frontend/lib/office/scenes/upload.ts` (shapes drawn from real data are `aria-hidden`; text stays in DOM overlays): all four handoffs, with the shelf counter rising as chunks come back to the visitor. The Chopper's cuts land at the real chunk boundaries and the shared overlap is shown on neighbouring cards; the Translator stamps each card with a fingerprint drawn from the first 32 numbers of its real vector; the stamped cards fly onto the vector map, into the visitor's own region.
  - Done when: one upload plays the whole scene.
  - Out of scope: the Ask page.
- [~] 5.9 Full Ask scene (SKIPPED for now by the owner; moving straight to launch, revisit after v1.0.0)
  - Do: the data-driven parts of the Ask scenes in `frontend/lib/office/scenes/ask.ts` (shapes drawn from real data are `aria-hidden`; text stays in DOM overlays): Translator, Scout with the Archivist pointing, Judge, Storyteller pinning badges, and the "nothing found" scene. The Translator highlights the question's words by their real influence weights and stamps a fingerprint on the question; the question then appears as a marker on the vector map; the Scout walks into the library with the lantern, whose light spreads over the map and lights the candidates it found, with words-based finds in a different colour from meaning-based finds; the Archivist points at the shelves (documents) they belong to; the Judge reorders the candidates and fades the rejected ones, using the real old and new ranks; the Storyteller's badges fly to the cited cards.
  - Done when: a good question and an unanswerable one both play correctly.
  - Out of scope: character detail panels.
- [~] 5.10 Character detail panels (SKIPPED for now by the owner; moving straight to launch, revisit after v1.0.0)
  - Do: click a character to see what it did: the Chopper's chunks and overlaps, the Translator's word weights, the Scout's matches with vector and keyword scores and matched words, the Judge's rank changes.
  - Done when: each panel shows real data from that question.
  - Out of scope: accessibility work.
- [~] 5.11 Accessibility (SKIPPED for now by the owner; moving straight to launch, revisit after v1.0.0)
  - Do: reduce-motion mode that swaps animations for a step list, alt text, keyboard access, and a text alternative for the vector map (a table of the nearest chunks with their scores).
  - Done when: the site is usable with motion off and with keyboard only.
  - Out of scope: new features.
- [~] 5.12 Source side panel (SKIPPED for now by the owner; moving straight to launch, revisit after v1.0.0)
  - Do: clicking a `[n]` marker or "Open source" on the Ask page opens a side panel next to the answer, without leaving the page. The panel shows the whole original so the visitor can scroll around and check it: a library Markdown or text document as text, a library PDF in the browser's PDF viewer opened at the cited page, and a pasted text from the browser's memory. In a text source the cited passage is highlighted and scrolled into view, as in step 3.6. The panel has next and previous buttons to move between the answer's citations, a close button, and a link to the full page (`/library/[id]`, `/texts/[index]`).
  - Done when: on the live site, every kind of source (Markdown, PDF, pasted text) opens in the panel with its cited passage visible, the answer stays on screen, and the panel can be opened, moved between citations and closed with the keyboard only.
  - Out of scope: highlighting the exact passage inside a PDF (ADR 002), editing or deleting documents, new backend endpoints.

## Phase 6: Launch

- [ ] 2.10 (You) Spend limit (moved from Phase 2)
  - Do: set a monthly spend limit (about $10) in the Anthropic Console, before any endpoint that calls Claude goes live.
  - Done when: the limit shows in the Console.
- [ ] 6.0 (You) Write the launch documents
  - Do: put the owner's own documents in `corpus/`: a FAQ about yourself (the questions a recruiter or collaborator would ask, with your real answers), CV, experience, projects and public contact details; plus 2 or 3 short made-up demo documents (for example a fictional company handbook) so visitors can try questions whose answers no model could know. Only include what you are happy to publish: everything in `corpus/` is public in `frontend/public/corpus/`.
  - Done when: the files are in `corpus/`.
- [ ] 6.0a Launch corpus and owner evals
  - Do: move the placeholder Wikipedia documents that do not fit the launch (Apple, Android, Microsoft, Samsung, Star Wars, Cyberpunk) from `corpus/` to `evals/corpus/`, so `make eval` still uses them but the live library does not; keep the RAG-related ones (RAG, information retrieval, vector database, large language model, search engine) as a small explainer set; add at least 8 eval questions about the owner's documents (the requirement deferred from 3.7) and 3 about the demo documents; run `make seed` against Supabase and remove the placeholder rows from it; run `make eval` and save a new baseline.
  - Done when: the live library lists the launch documents and `make eval` includes the owner questions.
  - Out of scope: new code.
- [ ] 6.1 Limits
  - Do: a 20,000-character limit on pasted text, a cap on the private chunks sent with one question, a per-IP daily quota for pastes and for questions (20 a day), and a question length cap. Counts live in a `usage` table (new migration); the IP comes from `X-Forwarded-For`.
  - Done when: each limit returns a clear error on the page, and the 21st question in a day is politely refused.
  - Out of scope: content screening, caching.
- [ ] 6.2 Auto migrations
  - Do: run `python -m app.migrate` before the server in Render's start command.
  - Done when: a deploy with a new migration succeeds.
  - Out of scope: new migrations.
- [ ] 6.3 Launch README
  - Do: live link, a GIF of both scenes, the architecture diagram, eval scores, "Run it yourself" and "Deploy your own".
  - Done when: a friend can run it locally from the README alone.
  - Out of scope: code changes.
- [ ] 6.4 (You) Release
  - Do: tag release `v1.0.0` and share the link.
  - Done when: the release page lists the changelog.

## Milestones

- [ ] Phase 0: public repo, step skills and protections in place
- [ ] Phase 1: both empty pages live, CI green on every PR
- [ ] Phase 2: the starter library is live and anyone can paste a private text on the live site
- [ ] Phase 3: cited answers on the live site, with a baseline eval score
- [ ] Phase 4: hybrid search, Judge and Dependabot shipped (Fact-Checker, LLM-judged evals, evals in CI and tracing skipped)
- [ ] Phase 5: all seven characters animating in the office rooms, a home page that explains RAG and the project, and the vector map (data-driven scenes, detail panels, accessibility and source side panel skipped)
- [ ] Phase 6: launch documents, limits and README done; v1.0.0 released
