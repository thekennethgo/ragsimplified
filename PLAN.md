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

The design lives on the Claude Design canvas "Upload Page Workshop" (https://claude.ai/artifact/XkNNxKuaj5gfEvSfFhR15F): a warm, isometric 3-D office in browns, with IBM Plex Sans and Mono. The design-to-code notes were removed from the repo (see git history). The cast is seven characters: the Clerk (greets the visitor on the Ask page and carries the question), the Chopper, the Translator and the Archivist (Upload), and the Scout, the Judge and the Storyteller (Ask). The Collector stays in the seed script and the Fact-Checker (4.3) is skipped, so neither has a character.

Step 5.1 builds the pages from the canvas and ports the animation in one go. Two test pages play today's scenes and are the reference for the rooms and the animation: the GSAP spikes for the Upload office and the Ask office with the Query room (removed from the repo; see git history). Both offices show the canvas's zoom, `viewBox="150 0 1060 600"`.

Office animation convention (ADR 004; added to `CLAUDE.md` in step 5.1): each room is one SVG in `frontend/public/office/` (`upload-room.svg`, `ask-room.svg`, `query-room.svg`, and the static `break-room.svg`) with its characters, their carried props and every extra moving part in it, animated in code with `gsap` and `@gsap/react` (exact versions in ADR 004). Ids: moving room parts in kebab-case; each character a group named after it, drawn in an 80 by 120 box with its feet at (40, 116), with a `<p>-flip` group and every part prefixed `<p>-` (`cl`, `ch`, `tr`, `ar`, `sc`, `ju`, `st`); home spots `spot-<name>` and walk targets `spot-<name>-<place>`. Scenes live in `frontend/lib/office/scenes/<room>.ts` as a map from `<step>_<status>` to a function that builds a paused timeline (optional label `handoff`); `frontend/lib/office/sceneQueue.ts` plays them one at a time, starting the next at the `handoff` label or 1 second after the end. All text with real data stays in the DOM.

- [x] 5.0 (You) Final design on the canvas
  - Do: finish the pages, the rooms (Upload office, Ask office, Query room, the home page's break room) and the seven characters on the canvas; pull every canvas file into the repo and commit it (later removed; the final art is in `frontend/public/office/`).
  - Done when: the files in git match the canvas.
- [x] 5.1 Office pages and animation (one PR; replaces the old steps 5.0a to 5.0f, 5.0h and 5.1 to 5.4)
  - Do: port the finished canvas design and the two tested GSAP pages (the GSAP spikes, removed from the repo; see git history) into `frontend/`, driven by the real backend.
    - Look and tabs: IBM Plex Sans and Mono with `next/font/google`; the canvas's tokens in `globals.css` (page #E4D8C6, panel #F6EFE4, paper #FBF6EC, border #D2C1A8, ink #33261D, muted text #6A5848, accent #7A5236, dark tab #4A3426; status chips: waiting #E4E1D8 on #4A3426, working #EDE1B8 on #5A4A12, done #DCE3D6 on #2F4F2A); the header's segmented tabs "Home | Upload | Ask" (icon and label, 44px tall, links with `aria-current="page"`), keeping the "Backend online" badge.
    - Room art: flat static SVGs (build scripts removed from the repo; see git history), copied to `frontend/public/office/`: `upload-room.svg` from the Upload spike, `ask-room.svg` and `query-room.svg` from the Ask spike, and the static `break-room.svg` from the canvas, each with its characters, props, moving parts and `spot-*` markers named by the convention above (offices in `viewBox="150 0 1060 600"`). Home spots as percentages in `frontend/lib/office-spots.ts` (`left = (x - 150) / 10.6`, `top = y / 6`).
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

- [x] 6.0 (You) Write the launch documents (moved up)
  - Do: review and finish the drafts of your own documents in `corpus-drafts/about-me/` (`personal.md`, `experience-and-projects.md`, `faq-about-kenneth.md`), written from your answers and CV. The CV itself is not added while it is a work in progress, and the phone number never goes in. Only include what you are happy to publish: everything in `corpus/` is public in `frontend/public/corpus/`.
  - Done when: you sign off the three drafts, ready for step 5.7c (L8).
- [x] 5.7c Launch corpus (moved up from 6.0a, expanded)
  - Do: follow steps L1 to L9 of the launch-library plan (removed from the repo; see git history): prove subfolders work, move the kept documents into their new shelves and the placeholders to `evals/corpus/`, add about 62 documents on 11 shelves (About Kenneth, This project, Places & interests, Movies & games, RAG basics, How AI works, AI history, AI and society, General, Real reports, and the fictional RAG.co company in `lore/`), move in the owner's signed-off documents, add their eval questions, reseed locally and save a new baseline. One PR per L step.
  - Done when: `corpus/` matches the layout in the plan, `make eval` includes the new questions with a saved baseline, and the local library and map show the new library.
  - Out of scope: seeding Supabase (6.0a), the download button (5.7d), PDF highlighting (5.7e), shelves (5.7f).
- [x] 5.7g Per-document cap in the Judge
  - Do: in `backend/app/pipeline/judge.py`, after reranking, keep at most 2 chunks from any one document in the final 5, filling the freed places with the next best candidates from other documents; the cap is a named constant shown in `GET /about`. Then run `make eval` and save the baseline.
  - Done when: a unit test with fixed reranker scores shows a third chunk from the same document replaced by the next document, and the `indirect-*` eval questions (added before this step) do not get worse.
  - Out of scope: the second look (5.7h), changing how many candidates the Scout passes on.
- [x] 5.7f Library shelves, starter questions and source lines
  - Do: follow steps P1 to P4 of the library-polish plan (removed from the repo; see git history): the File cabinet grouped by folder as shelves, the Ask page's starter questions grouped by shelf, a source and licence line in the viewer from `corpus/sources.json`, and the vector map coloured by shelf.
  - Done when: the plan's verification passes on localhost.
  - Out of scope: new endpoints, migrations.
- [x] 5.7h Second look (multi-hop retrieval, moved up from 7.1)
  - Do: write ADR 006 first. After the Judge, a two-stage check: Mercury Decide (a free System 1 decision model on OpenRouter) gives the probability that the top 5 sources answer the question, and only when it is low does a short LLM call through `llm.py` write one follow-up search query (the LLM decides alone when no OpenRouter key is set or the sources include pasted text) (for example "Batam Indonesia" for "What is Kenneth's hometown like?"); on a follow-up, the Scout searches again and the Judge picks the best 5 from both rounds, at most one extra round. New step events (`second_look` start and done, with the follow-up query) so the office can show it: reuse the Scout's existing walk and lantern tweens in `frontend/lib/office/scenes/ask.ts` for a second trip, with the follow-up query in the Scout's speech bubble (DOM), and a line in the Scout's character tab; no new room art.
  - Done when: the `indirect-*` and `cross-*` eval questions improve over the saved baseline, no other score drops by more than 2 points, and on localhost "What is Kenneth's hometown like?" shows the second trip and answers from the Batam document.
  - Out of scope: more than one extra round, query rewriting before the first search, the Fact-Checker, new character art.
- [x] 5.7d Download button
  - Do: follow step L10 of the launch-library plan (removed from the repo; see git history): a Download link for library documents and a Download button for pasted texts in the viewer.
  - Done when: both download the right file, with tests.
  - Out of scope: PDF highlighting.
- [x] 5.7e Highlight the cited passage in PDFs
  - Do: follow step L11 of the launch-library plan (removed from the repo; see git history): ADR 005, `react-pdf@9.2.1`, the cited page rendered in the viewer with the cited text marked, the extracted text kept as the fallback.
  - Done when: a citation from a PDF shows its passage marked on the right page, with tests.
  - Out of scope: highlighting inside the browser's own PDF viewer, the source side panel (5.12).
- [x] 5.7i Second look animation
  - Do: when a second look runs, the Judge walks to the Clerk at the whiteboard instead of handing the cards to the Storyteller, the Clerk rewrites the board with the follow-up query, and the Translator, Scout and Judge run again before the handover; no new room art.
  - Done when: the hometown question plays the rewrite and the second round on localhost, and a question that needs no second look plays exactly as before.
  - Out of scope: new characters, changes to how the second look decides.
- [x] 5.7j Meow, the office cat, a RAG.co rug, a taller viewer, shelf cards, Central Asia, and eval edge cases on the home page (moved up from 7.2)
  - Do: add Meow, the RAG.co office cat from the `lore/` documents, to the office rooms: a cat group `meow` in `frontend/public/office/upload-room.svg` and `ask-room.svg` (and the static `break-room.svg`), drawn in the rooms' style and named by the office animation convention in `CLAUDE.md`, with an idle loop (sleeping, tail flick, an occasional stretch) that ignores the step events and stops under reduced motion. Meow sleeps on the warm shelves, as the lore says. Also a flat RAG.co rug on each room's floor, a taller File cabinet viewer where a whole PDF page fits, starter questions as shelf cards, a Central Asia document with a trip section in `personal.md`, a "How we test it" section on the home page showing the eval edge cases, and a clearer split between `personal.md` and the FAQ (details in the Phase 5 plan, removed from the repo; see git history).
  - Done when: Meow shows in every room, the idle loop plays and stops with reduced motion, and the scene id tests still pass.
  - Out of scope: making Meow react to the pipeline, a character tab for Meow.
- [x] 5.7k Faster eval
  - Do: `make eval` runs without a sleep between questions, with 2 workers and a cached embedding for each question, plus new cases; the 55 questions finish in about 75 seconds.
  - Done when: the baseline is saved and `make eval` completes in about 75 seconds.
- [x] 5.7l Visitor PDF uploads
  - Do: the Upload page accepts a `.pdf`, read in the browser (page numbers kept), and citations from the visitor's PDFs open with the cited passage highlighted.
  - Done when: a pasted-in PDF can be asked about and its citation opens on the right page, with tests.
- [x] 5.7m Injection hardening and fact joining in the Storyteller
  - Do: the Storyteller ignores instructions planted in sources and joins facts that come from different cards.
  - Done when: the injection and cross-document eval questions pass at the saved baseline.
- [ ] 5.7b Page polish (moved after the features)
  - Do: polish the pages with the owner, Home first (layout, copy, spacing, visuals), then make Upload and Ask consistent with it. Each round is agreed with the owner in the browser before it is built.
  - Done when: the owner signs off on Home, Upload and Ask.
  - Out of scope: new features, the launch corpus, the scenes in 5.8 and 5.9.

- [~] 5.8 Full Upload scene (SKIPPED for now by the owner; moving straight to launch, revisit after v1.0.0)
  - Do: the data-driven parts of the Upload scenes in `frontend/lib/office/scenes/upload.ts` (shapes drawn from real data are `aria-hidden`; text stays in DOM overlays): all four handoffs, with the shelf counter rising as chunks come back to the visitor. The Chopper's cuts land at the real chunk boundaries and the shared overlap is shown on neighbouring cards; the Translator stamps each card with a fingerprint drawn from the first 32 numbers of its real vector; the stamped cards fly onto the vector map, into the visitor's own region.
  - Done when: one upload plays the whole scene.
  - Out of scope: the Ask page.
- [~] 5.9 Full Ask scene (SKIPPED for now by the owner; moving straight to launch, revisit after v1.0.0)
  - Do: the data-driven parts of the Ask scenes in `frontend/lib/office/scenes/ask.ts` (shapes drawn from real data are `aria-hidden`; text stays in DOM overlays): Translator, Scout with the Archivist pointing, Judge, Storyteller pinning badges, and the "nothing found" scene. The Translator highlights the question's words by their real influence weights and stamps a fingerprint on the question; the question then appears as a marker on the vector map; the Scout walks into the library with the lantern, whose light spreads over the map and lights the candidates it found, with words-based finds in a different colour from meaning-based finds; the Archivist points at the shelves (documents) they belong to; the Judge reorders the candidates and fades the rejected ones, using the real old and new ranks; the Storyteller's badges fly to the cited cards.
  - Done when: a good question and an unanswerable one both play correctly.
  - Out of scope: character detail panels.
- [x] 5.10 Character detail panels (moved up, expanded)
  - Do: a tab for every character on the Upload and Ask pages, openable at any time, each with plain words, this run's real data, and an 'Under the hood' section naming the real models and settings from `GET /about`; the Storyteller's shows the system prompt and the exact message sent; the speech bubbles say in plain words what each character is doing.
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
- [x] 6.0a (You) Launch seed
  - Do: with `DATABASE_URL` pointing at Supabase, run `make migrate` (the live database is missing migration 002, so `/map` fails today) and then `make seed`; remove the old placeholder documents from Supabase; check the live File cabinet and Map tab.
  - Done when: the live library lists only the launch documents and the live map works.
  - Out of scope: new code; the eval questions and baseline (done in 5.7c).
- [x] 6.0b (You) Keep-awake ping
  - Do: `.github/workflows/keep-awake.yml` pings the backend's `/health` every 10 minutes and `/library` daily, using the repository variable `BACKEND_URL`.
  - Done when: the workflow runs on schedule and the free Render service stays awake.
- [ ] 6.1 Limits
  - Do: a 20,000-character limit on pasted text, a cap on the private chunks sent with one question, a per-IP daily quota for pastes and for questions (20 a day), and a question length cap. Counts live in a `usage` table (new migration); the IP comes from `X-Forwarded-For`.
  - Done when: each limit returns a clear error on the page, and the 21st question in a day is politely refused.
  - Out of scope: content screening, caching.
- [ ] 6.2 Auto migrations
  - Do: run `python -m app.migrate` before the server in Render's start command.
  - Done when: a deploy with a new migration succeeds.
  - Out of scope: new migrations.
- [ ] 6.2a Rename to RAG Visualised
  - Do: rename the project from ragsimplified to RAG Visualised (`ragvisualised`) in code and docs: page titles and metadata, the header, `README.md`, `CLAUDE.md`, `docs/`, `corpus/` and `package.json` names; keep the eval database name and anything stored in the live database unchanged.
  - Done when: `grep -rni ragsimplified --exclude-dir=node_modules --exclude-dir=.git .` only finds intended leftovers, listed in the PR.
  - Out of scope: renaming the GitHub repo or the Vercel and Render projects (6.2b).
- [ ] 6.2b (You) Rename the repo and the deploys
  - Do: rename the GitHub repo to `ragvisualised`, rename the Vercel and Render projects, then update `CORS_ORIGINS` on Render and `NEXT_PUBLIC_BACKEND_URL` on Vercel to the new URLs, and `git remote set-url origin` locally.
  - Done when: the live site works on the new URLs and the old GitHub URL redirects.
- [ ] 6.3 Launch README
  - Do: live link, a GIF of both scenes, the architecture diagram, eval scores, "Run it yourself" and "Deploy your own".
  - Done when: a friend can run it locally from the README alone.
  - Out of scope: code changes.
- [ ] 6.4 (You) Release
  - Do: tag release `v1.0.0` and share the link.
  - Done when: the release page lists the changelog.

## Phase 7: Post-launch redesign (one-screen Ask)

After v1.0.0. The Ask page becomes one screen: answer first, the office animation alongside, the details on demand; then Home and Upload follow it. Each round is agreed with the owner in the browser before it is built.

- Branches: `alt-main` (cut from `codex/rag-visualised-rework` at `e7c3ac6`) is the alternative main for Phase 7. Sonnet builds each step on its own branch in a worktree cut from `alt-main`; `/ship-step` rebases it onto `origin/alt-main` and pushes it straight to `alt-main`, with no PR. Nothing from Phase 7 goes to `main` until the owner decides in 7.11.
- Browser review: after every step that changes the frontend, Opus runs the step's branch next to the current `alt-main` against the local Docker database and shows the owner the before and after in the browser. The step ships only after the owner approves it; the next step starts only after that.
- Current step: on `alt-main` and its step branches, the current step is the first unticked Phase 7 step, even while steps in Phases 5 and 6 are still open on `main`.
- Who does what: Claude Opus plans and writes the instructions; Claude Sonnet writes all the code, one step per session, following the step exactly.
- Mockup: `docs/mockups/ask.html` (serve the repo root with the `mockup` entry in `.claude/launch.json`, open `http://localhost:8765/docs/mockups/ask.html`). It is the target layout for 7.2 to 7.5; the copy and numbers in it are made up.
- Every step ends with `make lint` and `make test` passing, plus the browser checks it lists, at 390×844, 768×1024, 1024×768 and 1440×900 with no page-wide horizontal scroll.
- Out of scope: the eval changes (a later step), the scenes in 5.8 and 5.9, new room art.

- [x] 7.1 (You) Agree the Ask mockup
  - Do: the owner reviews `docs/mockups/ask.html` at 1440×900 and 390×844 and asks for changes until it is right; changes go into the mockup file, not the app.
  - Done when: the owner signs off on the mockup.
- [x] 7.2 Answer first, animation second
  - Do: in `frontend/app/ask/page.tsx`, real results no longer wait for scenes.
    - Keep two copies of the step states: `states` (what the backend has finished) is updated the moment each event arrives; a new `shown` state (what the office has played) is updated in the scene `onEnd` hooks exactly as `states` is today. The speech bubbles, `useFollow` and `clerkAway` read `shown`; everything else (chips, answer panel, tab data) reads `states`.
    - Deltas always append to `answer`, with animations on or off; delete the `pending` ref.
    - On the Storyteller's done event, call `setAnswer(final)`, `setCitations(sources)` and `setQuestion("")` at once, not in the `clerk_back` hook. The data setters (`setWords`, `setScout`, `setJudge`, `setLook`, `setTranslator2`, `setScout2`, `setJudge2`, `setRound2`, `setOverlay`, `setPrivateSent`, `setSentPrompt`) also run on arrival instead of in `onEnd`; the office-only ones (`setChecking`, `setScoutLook`, `setRewriting`, `setNoFile`) stay in the hooks.
    - `running` becomes `busy` only (the request), so the Ask button unlocks when the stream ends. Submitting while scenes are still playing calls `queue.skipAll()` first, then starts the new run.
  - Tests in `frontend/app/ask/page.test.tsx`: with animations on and a mocked stream that ends at once, the final answer and its citations are on screen before any scene ends; turning animations off mid-run keeps the answer; the Ask button is enabled as soon as the stream ends while the office is still animating.
  - Done when: the tests pass and, on localhost with animations on, the answer appears while the Clerk is still walking.
  - Out of scope: layout changes, pause or replay controls.
- [x] 7.2a Faster office
  - Do: make one run's office animation short enough not to bore.
    - Measure first. In `frontend/app/ask/page.tsx`, record `performance.now()` when a run starts, when the stream ends, and when the last scene's hook runs (where `setAnimating(false)` is called); in development only (`process.env.NODE_ENV === "development"`) log `[office] stream <a> s, office <b> s, tail <b - a> s`. Run "Where did Kenneth grow up?" and "What was Kenneth's first job after university?" on localhost with animations on, 3 times each, before any other change, and note the medians.
    - Pace, in `frontend/lib/office/scenes/ask.ts`: `MIN_WALK` 0.4 → 0.25; `SPEED` `{ clerk: 260, crew: 200 }`; the Scout's lantern sweep durations 0.8/1.1/0.9/0.6 → 0.3/0.4/0.3/0.2; the Judge's speech hold `"+=1.8"` → `"+=0.8"`; the Judge's head-tilt durations 0.25/0.4/0.4/0.25 → 0.15/0.25/0.25/0.15. Nothing else in the scenes changes.
    - Gaps, in `frontend/lib/office/useSceneQueue.ts` and `sceneQueue.ts`: `gapMs` 800 → 250 and the default `holdMs` 1000 → 300.
    - Catch-up: add `setSpeed(factor: number)` to the queue in `sceneQueue.ts`. It calls `timeScale(factor)` on the playing timeline and on every timeline it starts later, and divides the hold and gap waits by `factor`. `page.tsx` calls `queue.setSpeed(2)` when the stream ends and `queue.setSpeed(1)` when a run starts.
  - Tests: add a test in `frontend/lib/office/sceneQueue.test.ts` that `setSpeed(2)` halves a timeline's play time and the hold.
  - Done when: the tests pass, and the log on the same two questions, 3 runs each, shows a median `office` of 8 s or less for the first-job question and a median `tail` of 3 s or less for both. Paste the before and after medians into the report. If the targets are missed, stop and report the numbers instead of cutting more.
  - Out of scope: the Clerk (7.4a), new scenes or art, removing any character, the reduced-motion path.
- [x] 7.3 Answer card and "How it got there" tabs
  - Do: split `frontend/components/ask/AnswerPanel.tsx` into two components in the same folder.
    - `AnswerCard.tsx`: the question asked, the answer with its `[n]` markers, the sources list, one meta line (`<n> cards found · <n> kept · <model>`), and an inline source viewer: clicking a source's "Open" or a `[n]` marker renders `<DocViewer target={…} />` (from `components/viewer/DocViewer.tsx`) inside the card under the sources, with a Close button that returns focus to the link that opened it. Nothing scrolls the page.
    - `StepDetails.tsx`: a section headed "How it got there" with one tab per character (Clerk, Translator, Scout, Judge, Storyteller), each tab body exactly as the current AnswerPanel tab body, round switch included. No "Answer" tab. Its open tab is controlled by props (`tab`, `onTab`) so the page can open it from the step strip in 7.4. While running it follows the working step unless the visitor picked a tab (the current `touched` rule); once the run is done it stays where it is.
    - Delete `AnswerPanel.tsx` and `AnswerPanel.module.css` once nothing imports them; move their styles into `AnswerCard.module.css` and `StepDetails.module.css`. In `page.tsx`, `openViewer` no longer scrolls to `#library`; the answer's source target is a new `source` state passed to `AnswerCard`, separate from the `viewer` state the LibraryPanel uses.
  - Tests: move the AnswerPanel assertions in `page.test.tsx` to the new components; add one test that opening a citation shows the passage inside the answer card and keeps the answer text on screen.
  - Done when: the tests pass and every tab still shows this run's real data on localhost.
  - Out of scope: the page layout (7.4).
- [x] 7.4 One-screen Ask layout
  - Do: rebuild the Ask page's layout to match the mockup, in `frontend/app/ask/page.tsx`, `page.module.css` and `frontend/components/ask/QuestionBubble.tsx` (+ `.module.css`).
    - Order: header → question bar → starter row → a grid of the office scene (left) and `AnswerCard` (right) → `StepDetails` → the library.
    - Question bar: one-line input and the Ask button on one row (the input may grow to 3 lines when the text wraps). The starter row under it: a "See an example" button (wired in 7.5; until then hidden), the first 3 example questions from `examplesFor(library)` as chips, and a "Browse all topics" `<details>` that reveals the rest of the current example cards.
    - The Query room `OfficeRoom` and the `clerkSays` block are removed from the Ask page; the Clerk's current line shows as the scene's caption under the room. `frontend/public/office/query-room.svg` and `scenes/query.ts` stay in the repo.
    - The office scene is a dark bounded panel (`--room`) holding the Ask room, the caption, and a step strip of five buttons (Clerk, Translator, Scout, Judge, Storyteller) with a ✓ or "now" state from `states` and a 3px top border in the character's colour; clicking one opens that tab in `StepDetails`. Add the five colours as tokens in `frontend/app/globals.css`: `--clerk: #7a5236; --translator: #2f6f73; --scout: #a8721a; --judge: #9b3b2e; --storyteller: #4b6b3a;`, also used for the selected tab's underline in `StepDetails`. The AnimationToggle moves into the scene's caption row.
    - Grid: two columns (`minmax(0, 1.15fr) minmax(0, 1fr)`) from 900px wide; one column below. Under 760px the room picture is hidden behind a "Watch the office" button (`aria-expanded`), and the step strip shows short labels (Clerk, Words, Search, Check, Write).
    - The `LibraryPanel` moves into a closed `<details>` at the bottom headed "Browse the library" (it stays mounted so `onLoad` still fills the example questions).
    - `HealthBadge` moves to the header's right end.
  - Tests: update `page.test.tsx` for the removed Query room and the new starter row; the existing scene id tests still pass.
  - Done when: on localhost the question input and the answer card's top are visible without scrolling at 1440×900 and 1024×768, the input is visible without scrolling at 390×844, and there is no horizontal scroll at the four sizes.
  - Out of scope: Home and Upload (7.9), new room art.
- [x] 7.4a Clerk as bookends
  - Do: keep the Clerk at the whiteboard.
    - In `frontend/lib/office/scenes/ask.ts`: `reset()` places the Clerk at `P.clAtBoard`, facing the room, visible (opacity 1), so the Clerk is in the room before any question. `clerk_start` no longer opens the door or walks: it turns the Clerk to the board, runs `writeOnBoard(tl)`, adds the `handoff` label, and turns the Clerk back to the room. `clerk_done` no longer walks to the Storyteller or out of the door: when something was found it fades `#a-answer` out over 0.25 s after a 0.3 s pause; when nothing was found it returns `nothingToDo()`. `second_look_rewrite` is unchanged.
  - Tests: `frontend/lib/office/scenes/build.test.ts` keeps passing (`clerk_done` is still longer when something was found).
  - Done when: the tests pass and, on localhost, the Clerk stands at the whiteboard before any question, writes the question without walking in, and stays in the room after the answer.
  - Out of scope: pacing (done in 7.2a).
- [x] 7.4b Office in step with the answer
  - Do: the answer appears as the office reaches the Storyteller, not before, and the office is short enough that this costs at most a short pause. No character or scene is removed.
    - Shorter scenes, in `frontend/lib/office/scenes/ask.ts` (only these values change):
      - `writeOnBoard`: the six pen strokes become three, `[3, -6]`, `[-2, 1]`, `[3, -2]`, each `duration: 0.2`.
      - `translator_start`: the look back `"+=0.3"` → `"+=0.15"`; each `.crt-line` offset `"+=0.15"` → `"+=0.06"`; the `.crt-bar` stagger 0.15 → 0.08.
      - `translator_done`: the slip's `duration: 0.5` → 0.3; the pick-up offset `"+=0.2"` → `"+=0.1"`; `TRANSLATOR_PACE` 1.6 → 2.5.
      - `scout_start`: the beam's `duration: 0.6` → 0.3.
      - `scout_done`: each sheet's start `0.25 + i * 0.12` → `0.15 + i * 0.08` and its flight `duration: 0.45` → 0.3; the pile's `duration: 0.5` → 0.3; the walk to `P.scAtJudge` uses `JUDGE_PACE` as its pace.
      - `judgeRules`: the ranks' `stagger: 0.12` → 0.06.
      - `judgeHandsOver`: the walk to `P.jdAcrossDesk` gets a new `JUDGE_PACE = 1.6` (declared next to `TRANSLATOR_PACE`) as its pace; the handover `duration: 0.45` → 0.3; the Storyteller's arm `"+=0.5"` → `"+=0.2"`.
      - `storyteller_start`: each typed line's offset `"+=0.15"` → `"+=0.05"`.
      - `storyteller_done`: the held page `"+=0.8"` → `"+=0.2"`; the arm `"+=0.2"` → `"+=0.1"`.
    - Reveal, in `frontend/app/ask/page.tsx`: a new `revealed` state, `false` at the start of each run. It becomes `true` in the `onStart` hook of the `storyteller_start` scene (which also plays when nothing was found), at once when animations are off or are turned off during the run, and 2 s after the stream ends if neither has happened (one `setTimeout`, cleared at the next run). `AnswerCard` gets `answer={revealed ? answer : ""}` and `citations={revealed ? citations : []}`. `states`, the step strip and the `StepDetails` tabs keep updating on arrival as in 7.2.
    - Progress in the answer card: until `revealed`, `AnswerCard` shows one live line instead of "Working on it. Open a step below to watch.", passed as a new `progress` string prop and built in `page.tsx` from `shown` (so it matches the office): Translator working → "The Translator is reading your question…"; Scout working → "The Scout is searching the library…"; Judge working → "The Scout found <n> cards. The Judge is checking them…"; Storyteller working → "The Judge kept <k> of <n>. The Storyteller is writing…". `<n>` and `<k>` are the existing `scout.length` and `keptCount`.
    - Compact: in `AnswerCard.tsx`, the "Sources" heading and list render only once there is a revealed answer, and the empty state before a question is the single line "Your answer shows up here, with its sources.". In `page.tsx`, `StepDetails` sits inside a `<details>` closed by default whose `<summary>` is "How it got there"; clicking a step strip button opens it as well as choosing the tab. The `<h2>` inside `StepDetails` is visually hidden so the heading is not shown twice.
  - Tests:
    - `frontend/lib/office/scenes/build.test.ts`: a new test adds, along the normal path (`clerk_start`, `translator_start`, `translator_done`, `scout_start`, `scout_done`, `judge_start`, `judge_done`, `storyteller_start`, `storyteller_done`), each scene's `handoff` label time or, without one, its `duration()`, and expects the sum to be at most 14 s. Report the actual sum.
    - `frontend/app/ask/page.test.tsx`: replace 7.2's "the final answer and its citations are on screen before any scene ends" with: with animations on, the answer is not in the card until `storyteller_start` starts, then it is; with animations off it shows as soon as it arrives; with animations on and no scene played, it shows 2 s after the stream ends (fake timers); the progress line shows the Scout's count while the Judge's scene plays. Add one test that a step strip click opens the "How it got there" `<details>`.
  - Done when: the tests pass. On localhost (in the testing batch), for "What was Kenneth's first job after university?" with animations on, the answer appears at most 2 s after the stream ends and the `[office]` tail is at most 3 s; these replace 7.2a's targets.
  - Out of scope: removing characters or scenes, new art, the second-look scenes, the reduced-motion path, backend timing.
- [x] 7.4c Four-character Ask office
  - Do: the Clerk leaves the Ask office, so the four characters left are the four real stages (embed, search, rerank, write). The question and the answer appear on the whiteboard instead, and the walks that carry no meaning go. The owner agreed this in the chat on 2026-11-02.
    - Board marks, drawn in `buildProps()` in `frontend/lib/office/scenes/ask.ts` with the existing `el()` helper (no SVG art added): a group `#board-q` (question) with paths `M470 404L540 439` and `M470 412L520 437`, stroke `#2B2622`; a group `#board-a` (answer) with paths `M470 440L550 480`, `M470 448L535 480.5` and `M470 456L520 481`, stroke `#4b6b3a`; a group `#board-none` with the path `M500 452L520 462M520 452L500 462`, stroke `#9b3b2e`. All `stroke-width: 2.5`, `stroke-linecap: round`, `fill: none`, `opacity: 0`. `reset()` sets all three to `opacity: 0`.
    - Remove the Clerk from `ask.ts`: drop `cl` from `GROUP` and `HOME_FACING_LEFT`, `doorway`, `door` and `clAtBoard` from `P`, every `#clerk`/`#cl-*`/`#a-door-open` set or tween, `writeOnBoard`, and the `clerk` key of `SPEED` (the `walk` speed becomes `SPEED.crew` for everyone). Rename `P.jdAtClerk` to `P.jdAtBoard` and the SVG spot `spot-judge-clerk` to `spot-judge-board`.
    - Scenes in `ask.ts`:
      - `clerk_start` is renamed `question_start`: `reset()`, then `#board-q > *` fades in (`opacity: 1, duration: 0.2, stagger: 0.15`), then the `handoff` label.
      - `translator_start`: each `.crt-line` offset `"+=0.06"` → `"+=0.04"`.
      - `translator_done`: no walks. After the printer, `#a-slip` fades out (0.15 s) while `#sc-held-slip` fades in (0.15 s, `"<"`), then the `handoff` label, then the screen goes back to idle as today. Delete `TRANSLATOR_PACE` and `#tr-held-slip` use.
      - `scout_start`: the lantern sweep durations 0.3/0.4/0.3/0.2 → 0.2/0.25/0.2/0.15.
      - `scout_done`: no walks. The sheets fly as today, then `#j-pile` slides in from `{ x: -120, y: 15 }` as today, then the `handoff` label. Delete `#sc-held-stack` use and both Scout walks.
      - `judgeRules`: before the ranks, the magnifier sweeps three times (`#jd-arm-up` to `x: -3`, `x: 3`, `x: -3`, each `duration: 0.3, ease: "sine.inOut"`); the ranks' stagger 0.06 → 0.15. The rejects do not go into the Judge's hand: `#j-rejects` fades out (0.3 s) where `#jd-held-rejects` was shown; delete `#jd-held-rejects` use.
      - `judgeHandsOver`: after the `handoff` label the Judge walks from `P.jdPastDesk` straight to `P.jdSpot` (no `P.jdAtFiles` walk, no rejects tween). Delete `P.jdAtFiles` if nothing else uses it.
      - Nothing found (`tellsClerkNothing` → renamed `judgeFindsNothing(tl, held)`): no walks. `#board-none` fades in (0.3 s) with `#jd-says` as today, then the `handoff` label, then `held` fades out at the desk (0.3 s).
      - `second_look_rewrite`: the Judge walks to `P.jdAtBoard`, faces the board, `#board-q > *` fades out (0.2 s) and back in (`duration: 0.2, stagger: 0.15`), then the `handoff` label, then walks home. The 0.8 s pause becomes 0.4 s.
      - `storyteller_start`: each typed line offset `"+=0.05"` → `"+=0.15"`.
      - `storyteller_done`: each typed line offset `"+=0.1"` → `"+=0.2"`. After the held page, `#a-answer` flies to the board (`x: -440, y: 10, duration: 0.6, ease: "power2.inOut"`), fades out (0.2 s), and `#board-a > *` fades in (`opacity: 1, duration: 0.2, stagger: 0.15`).
      - `clerk_done` is deleted.
    - `frontend/public/office/ask-room.svg`: delete the `<g id="clerk">` group, the `<g id="a-door-open">` group and the spots `spot-clerk-doorway`, `spot-clerk-door`, `spot-clerk-board` and `spot-clerk-storyteller`.
    - `frontend/app/ask/page.tsx`:
      - Emit `question_start` where `clerk_start` is emitted; stop emitting `clerk_away`, `clerk_done`, `clerk_shrug` and `clerk_back`. The run's last hook (`setAnimating(false)` and the `[office]` log) moves onto the `storyteller_done` scene's `onEnd`, alongside its existing `update`.
      - Remove `clerkAway`, `clerkAt`, the Clerk's waiting bubble and `stripPhase`'s Clerk branch. `STRIP` loses the Clerk; the tab state starts on `"translator"`. `ASK_LABEL` names the Translator, Scout, Judge and Storyteller.
      - The caption (`clerkSays` → `caption`): error → "Sorry, something went wrong. Try again?"; `rewriting` → `The Judge asked for a better search: “<rewriting>”`; finished with nothing found → "Nothing on file about that. Try something else?"; finished → "Here's your answer. Open How it got there to see each step."; while the office is busy → the 7.4b `progress` line; otherwise "Ask a question and watch the office find the answer."
    - `frontend/components/ask/StepDetails.tsx`: no Clerk tab (`TabId`, the step list, `ROUND_TABS`, the Clerk's phase branch and copy). The Clerk tab's "Cards from your folder searched" chip moves to the Scout tab, so `privateSent` stays; the "Who decided" meter moves to the Judge tab's round 2 page. Delete `clerkCopy` from `frontend/lib/characters.ts` and its test if nothing else imports it.
    - Remove what only the Clerk used: `.clerkWaits` in `page.module.css`, `--clerk` in `globals.css`, and Clerk wording in the comments of `lib/sceneState.ts` and `page.tsx`.
  - Tests: update `build.test.ts` (scene list, handoffs, the nothing-found test, which now checks `storyteller_done` instead of `clerk_done`) and keep the normal-path sum test, now `question_start` to `storyteller_done`, at most 15.5 s (the Judge and Storyteller get more time on purpose; the backend Judge takes about 6.5 s anyway); report the sum. Update `ids.test.ts` for the removed spots and `page.test.tsx` for four tabs, four strip buttons and the new caption lines. Add a test that `storyteller_done` ends with `#board-a` visible.
  - Done when: the tests pass and no `clerk` id, scene name or tab is left in the Ask room, `ask.ts`, `page.tsx` or `StepDetails.tsx` (`grep -i clerk` on those files is empty).
  - Out of scope: the Home page's break-room Clerk and character cards (7.9), the Query room files (`query-room.svg`, `scenes/query.ts`), the Upload room, backend changes.
- [x] 7.4d Process beside the answer
  - Do: the owner's 2026-11-02 changes after the 7.4c preview. Ships together with 7.4c (the owner's choice).
    - Layout, in `frontend/app/ask/page.tsx` and `page.module.css`:
      - The grid's right column becomes a `<div className={styles.side}>` (flex column, `gap: 14px`, `min-width: 0`) holding `AnswerCard` and, under it, `StepDetails`. `StepDetails` is always shown: delete the `<details>` around it and the `stepsOpen` state; a step strip click only calls `setTab`. Its `<h2>` "How it got there" is visible again (drop the visually-hidden class).
      - From 900px wide, the office panel (`.scene`) is `position: sticky; top: 16px; align-self: start;` so it stays in view while the right column scrolls with the page.
      - "Browse the library" is no longer a `<details>`: a `<section className={styles.library} aria-labelledby="library-h">` with `<h2 id="library-h">Browse the library</h2>` and the `LibraryPanel` under it, always shown.
    - The Scout hands the cards to the Judge, in `scout_done` in `frontend/lib/office/scenes/ask.ts`: after the sheets, `#sc-held-stack` shows, the Scout walks to `P.scAtJudge` (`spot(root, "scout-judge")`) with `JUDGE_PACE`, `#sc-held-stack` hides as `#j-pile` slides in from `{ x: -120, y: 15 }` (0.3 s), the `handoff` label, then the Scout walks home and faces home. This is the 7.4b version of the scene with 7.4c's sheet timings.
    - The Storyteller takes the answer to the whiteboard, in `storyteller_done`: add the spot `<circle id="spot-storyteller-board" cx="676" cy="580" r="0">` to `#spots` in `ask-room.svg` and `stAtBoard: spot(root, "storyteller-board")` to `P`. After the citation marks: the Storyteller's arm goes up holding the page (`armUp(tl, "st", true)`), `#a-answer` hides, the `handoff` label, the Storyteller walks to `P.stAtBoard` with `JUDGE_PACE`, faces the board (left), `#board-a > *` fades in (`opacity: 1, duration: 0.2, stagger: 0.15`), the arm goes down. Delete the `#a-answer` flight to the board. The Storyteller stays at the board; `reset()` already puts every character home.
  - Tests: `build.test.ts` lists `storyteller_done` among the scenes with a `handoff`, and the normal-path sum (still at most 15.5 s) counts it up to that label; the "`storyteller_done` ends with `#board-a` visible" test still passes. `ids.test.ts` counts the new spot. `page.test.tsx`: drop the `<details>` tests; add that "How it got there" and "Browse the library" are visible without a click, and that a strip click selects its tab.
  - Done when: the tests pass, and in the owner's preview the Scout carries the cards to the Judge, the Storyteller walks the page to the board, and the Scout tab's map still reads in the right column at 1024×768 (if it doesn't, stop and report).
  - Out of scope: the Translator's, Judge's and nothing-found scenes, Home and Upload.
- [x] 7.4e One panel beside the office
  - Do: the answer and the step tabs become one tabbed panel to the right of the office, the same height as the office, so the two fill one screen. The owner agreed this on 2026-11-02 after comparing with `main`.
    - `frontend/components/ask/StepDetails.tsx`: a new first tab, `"answer"` ("Answer"), whose body is a new `answer: ReactNode` prop (the page passes its `<AnswerCard … />`). `TabId` gains `"answer"`; the Answer tab has no phase dot and no character colour. The `<h2>` becomes visually hidden (the global `visually-hidden` class) and reads "Answer and how it got there". Rename the existing `answer: string` prop to `answerText` so the two don't clash.
    - Following: while a run is going and the visitor hasn't picked a tab, the panel follows the newest finished step as today. A new `revealed: boolean` prop replaces `hasAnswer` in that rule. When `revealed` turns true and the visitor hasn't picked a tab this run, the panel calls `onTab("answer")`. A strip click or a tab click still counts as a pick.
    - `frontend/app/ask/page.tsx`: the right column holds only `<StepDetails answer={<AnswerCard … />} revealed={revealed} … />`. The tab state starts on `"answer"`, and each new run sets it back to `"answer"`.
    - Height, in `page.module.css`: from 900px wide, `.side` is `position: relative` and its child is `position: absolute; inset: 0; display: flex; flex-direction: column;`, so the panel never makes the row taller than the office. The tab row stays fixed and the tab body scrolls (`flex: 1; min-height: 0; overflow: auto`). The office `.scene` loses `position: sticky`. Below 900px the panel is in normal flow and the tab body has `max-height: 70vh; overflow: auto`.
  - Tests in `page.test.tsx`: the answer is in the Answer tab; when the answer is revealed with no tab picked, the Answer tab is selected; after a strip click during the run, the reveal leaves the picked tab open; a new run starts on the Answer tab. Update the StepDetails tests for the new tab and the `answerText` rename.
  - Done when: the tests pass, and in the owner's preview at 1440×900 and 1024×768 the office and the panel sit side by side at the same height with the question bar above them, all on one screen.
  - Out of scope: the office scenes, Home and Upload, merging `main`'s 4 newer commits (a later step).
- [x] 7.4f Tighter room, roomier panel
  - Do: the owner's 2026-11-02 changes after the 7.4e preview: more space for the answer panel, less chrome around the room. Ships together with 7.4e (the owner's choice).
    - Crop the room: in `frontend/public/office/ask-room.svg`, `viewBox="150 0 1060 600"` → `viewBox="270 40 780 560"`. That keeps everything the scenes use (printer at x 286 to the Judge's desk at x 1020, the board's foot at y 591) and drops the empty sides. Nothing else in the SVG changes.
    - Grid, in `frontend/app/ask/page.module.css`: from 900px, `grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr)` (office, panel).
    - No step strip: delete the strip of step buttons under the room (`STRIP`, its markup and CSS) from `page.tsx`. The panel's tabs already switch steps and show each step's state.
    - Colour-coded tabs, in `frontend/components/ask/StepDetails.module.css`: every character tab has `border-top: 3px solid var(--c)`; the Answer tab keeps its current colours. The tab row never wraps: `flex-wrap: nowrap`, `gap: 4px`, each tab `padding: 4px 9px; font-size: 13px; white-space: nowrap`, and the row gets `overflow-x: auto` as a fallback.
    - Smaller room bubbles: in `frontend/components/office/SpeechBubble.tsx`, drop the inline `width: "16%"` and set `width: max-content; max-width: 150px`; in `SpeechBubble.module.css`, `.bubble` padding `5px 8px` and `.text` `font-size: 11px; line-height: 1.3`.
    - Compact character intro in the Ask tabs: `frontend/components/characters/CharacterCard.tsx` gets a `compact?: boolean` prop (default false, so Upload's `WhatHappened` is unchanged). When true, the intro is one row: the headshot at 32px, the name, the phase chip and the `role` sentence; `plain` moves to the top of "Under the hood". `StepDetails` passes `compact`. Add the `.compact` styles in `CharacterCard.module.css`.
    - Revised after the owner's second 7.4f preview (these override the bullets above where they differ):
      - Tighter crop: `viewBox="280 60 750 545"` (zooms in a little more; keeps the printer, the Judge's desk, the wall count sign and the Storyteller at the board).
      - Taller row: from 900px, `.grid` gets `height: clamp(460px, calc(100svh - 250px), 760px)`. The office `.scene` is a flex column: the room picture takes the space left (`flex: 1; min-height: 0`), centred and keeping its aspect ratio (the SVG fills the box with its default `preserveAspectRatio`), with the speech line and the caption under it.
      - Speech under the room, not over it: the Ask page no longer renders `SpeechBubble`s or calls `useFollow`. Between the room and the caption, one line per character whose scene is playing (`shownPhase(step) === "working"`, plus the Judge while `rewriting`): the name in its colour (`color: var(--<id>)`, bold) then its existing `crewSays` text, `font-size: 12px`, each line clamped to one line with an ellipsis. Delete the Ask-only bubble CSS. `SpeechBubble` stays for Upload.
      - Tab order: Translator, Scout, Judge, Storyteller, Answer (the Answer tab last, on the right). The tab state still starts on, and returns to, `"answer"`.
      - Folder tabs: the tab row sits on top of the panel's box, touching its top edge. The box (`.body`) carries the panel background and border; the selected tab shares the box's background with no bottom border. Selected tabs are not filled with colour: every character tab keeps its 3px top border in `var(--c)`, and the selected one is marked by the box background and `font-weight: 600`.
  - Tests: update `page.test.tsx` for the removed strip (the strip-click tests now click the panel's tabs, and the "strip click survives a later step" test becomes the same for a tab click). Add a `CharacterCard` test: with `compact`, `plain` sits inside "Under the hood"; without it, outside.
  - Done when: the tests pass, and in the owner's preview at 1440×900 and 1024×768 the office and the panel still sit side by side at the same height on one screen, the tab row is one line, and the bubbles sit over the characters without covering the room.
  - Out of scope: the scenes' timings, Home and Upload.
- [x] 7.4g Main's pacing in the new layout
  - Do: the owner's 2026-11-02 changes after the 7.4f preview: keep the 7.4f layout, but bring back `main`'s pace and explanations. Ships together with 7.4e and 7.4f (the owner's choice).
    - Pace, in `frontend/lib/office/scenes/ask.ts`, `useSceneQueue.ts` and `sceneQueue.ts`: every duration, offset, stagger, pace, `MIN_WALK`, `SPEED`, `gapMs` and `holdMs` goes back to its value on `origin/main` (`git show origin/main:<path>`), and the walks `main` has come back: the Translator walks the slip to the Scout and back, the Scout walks the cards to the Judge and back, and the Judge walks the cards across the Storyteller's desk and back. Three things stay as they are now:
      - no Clerk (7.4c);
      - the Judge's rejects fade at the desk, with no walk to the file cabinet;
      - the question appears on the board in `question_start`, and the nothing-found scene shows the board cross without walks.
      The Judge's three magnifier sweeps from 7.4c go (main's `judgeRules` returns). Delete the normal-path sum test from `build.test.ts`.
    - The Storyteller walks back: in `storyteller_done`, after `#board-a` is written, the arm goes down, the Storyteller walks from `P.stAtBoard` to `P.stSpot` (crew pace) and faces home.
    - The answer waits for the office: in `page.tsx`, delete the 2 s fallback timer and the `setSpeed` calls. `revealed` becomes true only at the `storyteller_start` scene's start, or at once with animations off or turned off mid-run. Delete `setSpeed` from `sceneQueue.ts`, `types.ts`, its test and the test mocks, since nothing uses it any more.
    - Speech bubbles again, no caption:
      - Bring back the `SpeechBubble`s over the characters with `useFollow` as in 7.4e, keeping 7.4f's smaller bubble style, and delete the speech lines under the room.
      - The caption text under the room goes; the row keeps only the AnimationToggle.
      - The caption's sentence stays in the DOM as a visually hidden `aria-live="polite"` paragraph (the global `visually-hidden` class), so screen readers still hear the progress.
    - Longer explanations: `StepDetails` stops passing `compact` to `CharacterCard`, so each tab shows the role and the `plain` explanation beside the headshot, as on `main`. Delete the `compact` prop, its CSS and its test.
    - Translator, second look: on the Translator tab's round 2 page, the new query is the headline in large type (`font-size: 20px; font-weight: 600`, as "New search: “<query>”"). The word weights are not shown on round 2; they belong to the visitor's own question on round 1.
    - Sources open below: in `AnswerCard`, a source's "Open" and the citation popover's "Open in viewer" open the passage in the library's viewer at the bottom (`openViewer`, which again scrolls `#library` into view, as before 7.3). Delete the inline `DocViewer`, the Close button, the `source` state and its props.
  - Tests:
    - `build.test.ts`: the Storyteller ends at `P.stSpot`.
    - `page.test.tsx`:
      - the answer appears only when `storyteller_start` starts, with no timer;
      - the bubbles are back and the caption is visually hidden;
      - the Translator's round 2 page shows the new query and no word weights;
      - "Open" puts the passage in the library viewer.
    - Update or delete the tests for removed behaviour (the 2 s fallback, `setSpeed`, `compact`, the inline viewer).
  - Done when: the tests pass, and in the owner's preview the office plays at `main`'s pace and the answer appears with the Storyteller.
  - Out of scope: the layout from 7.4e/7.4f, Home and Upload (7.9), passage-level highlighting.
- [ ] 7.5 Recorded example run
  - Do: a "See an example" button plays a real recorded run with no backend call.
    - Record: `curl -sN -X POST "$BACKEND/ask" -H 'Content-Type: application/json' -d '{"question":"Where did Kenneth grow up?","private_chunks":[]}' > frontend/public/examples/grew-up.stream` against the live backend, saved byte for byte as the backend sent it. The hometown question is chosen because it plays the second look.
    - Play: in `page.tsx`, move the body of the `for await` loop into `handleEvents(events: AsyncIterable<StreamEvent>)`. A live question passes `readEvents(response)`; the example passes `readEvents(new Response(await (await fetch("/examples/grew-up.stream")).text()))` wrapped in a generator that waits 400 ms before each step event and 15 ms before each delta, so it reads like a live run.
    - The answer card's meta line says "Recorded example, <date of the recording>" instead of the model during an example. The example never sends `private_chunks`.
    - Home: the hero's primary button stays "Ask a question"; add a secondary link "See an example" to `/ask?example=1`, which starts the example on load.
  - Tests: the example plays from a mocked `fetch` of the file and ends with the recorded answer and citations; `/ask?example=1` starts it.
  - Done when: the example plays on localhost with the backend stopped.
- [ ] 7.6 Honest status and bounded requests
  - Do:
    - `frontend/components/HealthBadge.tsx` labels: `checking` → "Waking the server…", `online` → "Server awake", `offline` → "Server unreachable". The offline note in `QuestionBubble.tsx` says "The server isn't answering right now. It may be waking up; try again in a minute."
    - `page.tsx`: each run gets an `AbortController`; the fetch uses `AbortSignal.any([controller.signal, AbortSignal.timeout(90_000)])`. While busy the Ask button becomes "Cancel" and aborts. Cancel shows "Stopped." and a timeout shows "This took too long. Try again." Neither is the generic "Could not reach the backend".
    - A stream that ends without a Storyteller done event or an error event shows "The answer was cut off. Try again." and marks the working steps as failed.
    - The question is never cleared on any failure, so the Ask button retries it as is.
  - Tests: cancel, timeout (fake timers) and cut-off stream each end in their message with the question kept and the Ask button enabled.
  - Done when: the tests pass and no state leaves the button on "Asking…".
  - Out of scope: backend changes, request ids, dependency checks in `/health`.
- [ ] 7.7 Measure the word attribution
  - Do: add `backend/scripts/time_translator.py`, which uses `VoyageEmbedder` with `VOYAGE_API_KEY` from the environment to time, for each of these 5 questions, `embedder.embed([q], input_type="query")` against `translate_question(embedder, q)`, 5 runs each, and prints the median of each and the difference: "Where did Kenneth grow up?", "What was Kenneth's first job after university?", "What is the coffee machine policy at RAG.co?", "Which projects has Kenneth built with Python and what did each one do?", "What does Meow do all day?". Run it with `cd backend && .venv/bin/python scripts/time_translator.py`.
  - Done when: the numbers are pasted into the PR description.
- [ ] 7.8 Word attribution off the critical path (only if 7.7's median difference is 200 ms or more; otherwise tick it as skipped with the numbers)
  - Do: in `backend/app/ask.py` `run_ask`, round 1 embeds the question alone, emits the Translator's done event with `words: []` and the point, and starts `translate_question` in a `concurrent.futures.ThreadPoolExecutor(max_workers=1)` before the Scout runs. Right after the Scout's done event it emits `StepEvent(step="translator_words", status="done", data={"words": words})`. If attribution raises, it logs `translator_words failed` with the exception type only (no question text) and emits `words: []`; the answer still runs. `explain_words=False` emits no `translator_words` event. Frontend: `page.tsx` sets `words` from `translator_words` and passes it to no scene; `sceneReducer` ignores the step.
  - Tests: `backend/tests/test_ask.py` checks the event order, that a failing attribution still yields an answer, and that `explain_words=False` emits no `translator_words` event; `page.test.tsx` checks the words appear on the Translator tab after a `translator_words` event.
  - Done when: the tests pass and 7.7's script, rerun, is pasted into the PR with the before/after numbers.
- [x] 7.9a Home: one screen, four characters, ready for clips
  - Do: in `frontend/app/page.tsx` and `page.module.css` (agreed with the owner on 2026-11-02):
    - Hero, two columns from 900px (one below): on the left the headline, the subline and the two buttons as today; on the right a `<figure className={styles.clip}>` showing `<img src="/office/ask-room.svg" alt="The Ask office: the Translator, Scout, Judge and Storyteller at work">` with the caption "The office answering a question". A `HERO_CLIP` constant (`null` for now) switches it to `<video autoPlay muted loop playsInline poster="/office/ask-room.svg">` once a clip exists; with `prefers-reduced-motion: reduce` the video is not rendered and the image shows.
    - New section right after the hero, headed "Ask it something the internet doesn't know": "RAG is easiest to judge on facts a model can't already know, because then every claim has to come from a cited card. The creator, Kenneth, added cards about himself, so ask about him." Under it three example questions as plain text ("Where did Kenneth grow up?", "What is Kenneth's academic background?", "What project is Kenneth most proud of?") and a link button "Ask about Kenneth" to `/ask`.
    - "What is RAG?": the three-step `<ol>` becomes four cards in a row (two by two below 900px), one per character, each with a 3px top border in `var(--<id>)`, the name, and one line: Translator "Turns your question into numbers that capture its meaning."; Scout "Searches the library by meaning and by words."; Judge "Reads what was found and keeps only the best few."; Storyteller "Writes the answer from those cards and cites each one.". Each card takes an optional `clip` from a `STEPS` array (all `null` for now) and renders the same video-or-nothing rule as the hero. The "Same question, both ways" comparison stays beside it as today.
    - "Why not just ask the model?" and "FAQ" sit side by side from 900px (one column below).
    - The break room and "How we test it" are unchanged.
    - Revised after the owner's 7.9a preview (these override the bullets above where they differ):
      - The break room section is removed.
      - Order after the hero: "What is RAG?" (left) and "Ask it something the internet doesn't know" (right) side by side from 900px (`minmax(0, 1.6fr) minmax(0, 1fr)`; one column below, "What is RAG?" first). The four character cards sit two by two inside "What is RAG?".
      - "Why not just ask the model?" is renamed "Why use RAG instead?", and the "Same question, both ways" comparison moves into it (out of "What is RAG?"). "Why use RAG instead?" and "FAQ" stay side by side.
  - Tests in `frontend/app/page.test.tsx`: the new section's heading and its link to `/ask`; four character cards; no `<video>` while the clips are `null`.
  - Done when: the tests pass and the owner signs off in the preview at 1440×900.
  - Out of scope: recording the clips (a later step), the break room art, Ask and Upload.
- [x] 7.9b Upload in the Ask layout
  - Do: in `frontend/app/upload/page.tsx` and `page.module.css`, the Ask page's layout (7.4e to 7.4g):
    - Order: `EnvelopeForm` (its mail design unchanged, centred, `max-width: 760px`) → a grid of the office (left) and `WhatHappened` (right) → the library, always open.
    - The office is the same dark panel as on Ask (copy the `.grid`, `.scene`, `.room` and `.side` rules from `frontend/app/ask/page.module.css`, same values), holding the Upload room, the document count, the speech bubbles and the AnimationToggle row. The visible "The office" title goes; the page gets a visually hidden `<h1>` "Upload a document".
    - `WhatHappened` is the right panel at the office's height with folder tabs like `StepDetails` (copy its tab rules from `StepDetails.module.css`), in the order Chopper, Translator, Archivist, with colour tokens `--chopper: #8a5a2b;` and `--archivist: #5a5f8a;` added to `globals.css` (the Translator uses `--translator`). Its follow rule is unchanged.
    - Revised after the owner's 7.9b preview (these override the bullets above where they differ):
      - No envelope above the grid. The page is the grid only (room left, panel right, the Ask page's row height), then the library.
      - The envelope becomes the panel's first tab, "Your document", before Chopper, Translator and Archivist: its body is `EnvelopeForm` with the mail design unchanged (it scrolls inside the tab body when the panel is shorter than the envelope). The page opens on that tab; on send the panel follows the steps as today, and a new upload starts on "Your document" again.
      - Room: `frontend/public/office/upload-room.svg` `viewBox="150 0 1060 600"` → `viewBox="180 90 1030 510"` (keeps the inbox where the envelope lands, the file cabinets with the count sign, and the mail trolley; drops the empty wall top). The sides stay because the inbox and the cabinets reach both edges. The Upload grid gives the room the wider column: `minmax(0, 1.3fr) minmax(0, 1fr)`. `UPLOAD_DOC_COUNT` in `frontend/lib/office-spots.ts` becomes `{ left: 81.9, top: 27.6 }` so the count stays on the cabinet plaque (same SVG point, x 1023, y 231, in the new viewBox).
    - Narrower Upload room (the owner's choice on 2026-11-02, replacing the crop above): the room's depth along the left wall shrinks from 600 to 380 room units, so it has about the Ask room's shape. The projection is the Ask room's: screen `X = 640 + 0.8 (x − y)`, `Y = 210 + 0.4 (x + y) − 0.8 z`, with the floor at `x` 0–700 (right wall) and `y` 0–600 (left wall). Moving something by `Δy` room units moves it on screen by `(−0.8 Δy, +0.4 Δy)`; for `Δy = −220` that is `translate(176, −88)`.
      - Floor and walls in `upload-room.svg`: every point at room `y = 600` moves to `y = 380`; points at `y ≤ 380` stay. The floor becomes `M640 210L1200 490L896 642L336 362Z`, its front-left edge `M336 362L896 642L896 661.2L336 381.2Z` and front-right edge `M1200 490L896 642L896 661.2L1200 509.2Z`, the left wall `M640 210L336 362L336 154L640 2Z`; the plank lines are the ones at `y = 40, 80, … 360` only (from `x = 0` to `x = 700`). Any other `#walls`/`#floor` path that reaches `y = 600` (trim, baseboard, wall top) gets the same change.
      - Moved by `translate(176, −88)` (`Δy = −220`), each by adding the transform to the group, not by rewriting its paths: `bench-lamp`, `chopper-bench`, `paper-cutter`, `cutter-sheet`, `cutter-blade`, `cut-cards`, `scissors`, `scrap-bin`, `inbox-cabinet`, `envelope`, `mail-trolley`, and the spots `spot-chopper` and `spot-chopper-inbox` (their `cx`/`cy` change by +176/−88).
      - Moved by smaller steps along the left wall so nothing overlaps: `window`, `blinds` and `window-light` by `translate(48, −24)` (`Δy = −60`); `calendar` by `translate(56, −28)`; `cork-board` by `translate(160, −80)`; `rug` by `translate(80, −40)`.
      - Everything else (the Translator's desk, the stamp table, the file cabinets, Meow, the clock, the whiteboard, the plant) stays where it is.
      - `viewBox="326 0 884 666"`, the Upload `.stage` `aspect-ratio: 884 / 666`, and `UPLOAD_DOC_COUNT` `{ left: 78.9, top: 34.7 }` (the same SVG point, x 1023, y 231).
      - If after these moves two things overlap or something sits off the floor, nudge only that item by at most 20 screen units, and list every nudge in the report. Don't move anything not listed above.
  - Tests: update `frontend/app/upload/page.test.tsx` for the new order and the hidden title; the existing WhatHappened tests still pass.
  - Done when: the tests pass, and in the owner's preview at 1440×900 and 1024×768 the envelope sits above the office and the panel, which share one height on one screen.
  - Out of scope: the upload scenes, the envelope's own design, Home.
- [ ] 7.9c (You) Mobile check
  - Do: once 7.9a and 7.9b are on `alt-main`, Opus runs Home, Ask and Upload in the browser at 390×844, 360×740 and 768×1024, with one live question and one upload, and shows the owner each page. Checked on every page: no horizontal page scroll; the question bar or envelope is visible without scrolling; the office folds behind "Watch the office" under 760px; the tab row scrolls sideways instead of wrapping; the bubbles stay inside the room or stack under it; every button and tab is at least 44px tall; the library and the viewer work by touch; reduced motion shows the finished state.
  - Done when: the owner signs off on the three pages at the three sizes; any fixes become their own steps.
- [x] 7.9d Mobile fixes
  - Do: the four fixes found in the 7.9c mobile check on 2026-11-03 (390×844, 360×740, 768×1024).
    - The selected tab is always in view: in `frontend/components/ask/StepDetails.tsx` and `frontend/components/upload/WhatHappened.tsx`, whenever the selected tab changes (and on first render), the tab row's `scrollLeft` is set so the selected tab button is fully inside the row (`row.scrollTo({ left: …, behavior: "instant" })`, computed from the button's `offsetLeft` and width). The page itself never scrolls for this, so no `scrollIntoView`. The tab order stays as it is.
    - Upload folds the office on phones: `frontend/app/upload/page.tsx` and `page.module.css` get the Ask page's "Watch the office" button and rule (under 760px the room is hidden until the button is pressed, `aria-expanded`), copied from `frontend/app/ask/page.tsx`/`page.module.css` with the same markup, state name and CSS values.
    - Upload shows the office on send (phones only): on submit, when `window.matchMedia("(max-width: 759px)").matches`, the page sets the room open and scrolls the office section into view (`scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" })`, using `reducedMotion` from `frontend/lib/office/motion.ts`).
    - Tap targets of at least 44px under 760px: in each element's own CSS module, inside `@media (max-width: 759px)`, add `min-height: 44px` (with `display: inline-flex; align-items: center` where needed so the label stays centred) to: the example-question chips and the "Browse all topics" summary in `QuestionBubble.module.css`; the "Watch the office" button on Ask and Upload; the tab buttons in `StepDetails.module.css` and `WhatHappened.module.css`; on Home (`frontend/app/page.module.css`), the hero buttons, "Ask about Kenneth", and the FAQ and "How we test it" links ("See the Scout", "See the Judge", "Try it", "GitHub", "See all the evals"); and the nav links in `frontend/components/Nav.module.css`. Nothing changes at 760px and wider. The map's zoom buttons and links inside running text are left as they are.
    - Added after the owner's 7.9d preview:
      - The panel no longer jumps back from the Judge to the Scout. Cause: during the second look the Judge's played phase is "working" again, and the follow rule in `StepDetails.tsx` picks the newest *finished* step in `FOLLOWED` order, which is then the Scout. New rule: follow the last step in `FOLLOWED` order whose played phase is `"working"`; if none is working, the newest `"done"` one as today. The visitor's pick and the Answer-tab switch on reveal are unchanged.
      - The remaining small controls under 760px, in their own CSS modules: the Animations switch (`frontend/components/office/AnimationToggle.module.css`), the library's "Vector map", "Documents" and "Viewer" tabs (`frontend/components/LibraryPanel.module.css`), the topic cards under "Browse all topics" (`QuestionBubble.module.css`) and Home's GitHub icon link (`frontend/app/page.module.css`) get `min-height: 44px` (the icon link also `min-width: 44px`).
  - Tests: `StepDetails`: with the Judge's played phase back to "working" during the second look (and the Scout "done"), the Judge tab stays selected. `StepDetails`: selecting the last tab sets the row's `scrollLeft` (mock `offsetLeft`/`clientWidth` in jsdom). `upload/page.test.tsx`: the "Watch the office" button toggles `aria-expanded`; with `matchMedia` mocked to match, submitting opens the room and calls `scrollIntoView` on the office section.
  - Done when: the tests pass, and in Opus's preview at 390×844 and 360×740 the Answer tab is visible when selected, Upload opens with the envelope near the top and the office folded, Send brings the office into view, and no button, tab, chip or summary listed above is under 44px tall; then the owner checks it on a real phone.
  - Out of scope: desktop sizes, the office scenes, reduced-motion behaviour beyond the scroll above, the library's map controls.
- [x] 7.9e Decider on the paid Mercury Decide
  - Do: the free `inception/mercury-decide:free` was withdrawn (OpenRouter 404, 2026-11-03); switch to the paid slug.
    - `backend/app/pipeline/decider.py`: `MODEL = "inception/mercury-decide"`. In the module docstring, "a free yes/no decision model" becomes "a cheap yes/no decision model ($0.02 per million input tokens)".
    - `backend/app/pipeline/second_look.py` docstring: "Stage 1 (decider.py, free)" → "Stage 1 (decider.py, cheap)".
    - `docs/adr/006-second-look.md`: the slug becomes `inception/mercury-decide`; "(System 1, free)" → "(System 1, cheap)"; the sentence "Why a System 1 decision model for stage 1: it is free," → "Why a System 1 decision model for stage 1: it costs about $0.0001 a question,". Add at the end of the Consequences section: "- 2026-11-03: the free `:free` slug was withdrawn; the app now uses the paid `inception/mercury-decide`, which needs OpenRouter credit. Without credit, every decider call fails and the language model decides alone."
    - `README.md` line 128: the slug becomes `inception/mercury-decide`.
    - Tests: replace the slug in `backend/tests/test_about.py`, `backend/tests/test_decider.py`, `frontend/app/ask/page.test.tsx` and `frontend/lib/characters.test.ts`.
  - Done when: `make lint` and `make test` pass; after the owner adds OpenRouter credit, a live question's `second_look` event has a number for `enough`.
  - Out of scope: a health check on the decider, other decision models, the thresholds.

- [x] 7.9f OpenRouter takes over when Gemini runs out
  - Do: in `backend/app/llm.py`:
    - `_open_stream` takes `retry_429: bool = True`; when it is `False`, a 429 is raised at once (5xx are still retried). `OpenAICompatibleLLM` and `AnthropicLLM` take `retry_429: bool = True` and pass it on.
    - New, after `AnthropicLLM`:
      ```python
      OPENROUTER_URL = "https://openrouter.ai/api/v1"
      FALLBACK_COOLDOWN = 60.0  # seconds the primary is skipped after a 429


      class FallbackLLM:
          """The primary LLM, or `fallback` when the primary answers 429 (its quota is used up).

          `model` is the model that served the latest call, so the answer can name it.
          """

          # shortcut: shared by every request in this process, lost on restart; fine for one Render instance.
          skip_until = 0.0

          def __init__(self, primary, fallback, clock=time.monotonic) -> None:
              self.primary, self.fallback, self.clock = primary, fallback, clock
              self.model = primary.model

          def stream(self, system, messages, *, max_tokens=None):
              if self.clock() >= FallbackLLM.skip_until:
                  self.model = self.primary.model
                  started = False
                  try:
                      for piece in self.primary.stream(system, messages, max_tokens=max_tokens):
                          started = True
                          yield piece
                      return
                  except httpx.HTTPStatusError as error:
                      if started or error.response.status_code != 429:
                          raise
                      FallbackLLM.skip_until = self.clock() + FALLBACK_COOLDOWN
              self.model = self.fallback.model
              yield from self.fallback.stream(system, messages, max_tokens=max_tokens)
      ```
      (add the type hints the file already uses: `LLM`, `list[Message]`, `int | None`, `Iterator[str]`).
    - `get_llm`: read `fallback = os.environ.get("LLM_FALLBACK_MODEL")`. Build the primary as today with `retry_429=not fallback`. If `fallback` is set, return `FallbackLLM(primary, OpenAICompatibleLLM(OPENROUTER_URL, os.environ["OPENROUTER_API_KEY"], fallback))`; otherwise return the primary. Update the module docstring with one line on `LLM_FALLBACK_MODEL`.
    - `backend/app/ask.py`: the final `storyteller` done event's data gets `"model": getattr(llm, "model", None)`.
    - `backend/app/about.py`: `llm` gets `"fallback_model": os.environ.get("LLM_FALLBACK_MODEL") or None`.
    - `frontend/lib/about.ts`: `llm` gets `fallback_model: string | null`. `frontend/lib/characters.ts` `storytellerCopy`: when `llm?.fallback_model` is set, `how` ends with `` ` If ${name} runs out of quota, the same request goes to ${llm.fallback_model} through OpenRouter.` ``
    - `frontend/app/ask/page.tsx`: keep the storyteller done event's `model` in a new `answerModel` state (reset to `null` on submit) and pass it to `AnswerCard` as `model`. `frontend/components/ask/AnswerCard.tsx`: optional prop `model?: string | null`; the footer shows `{model || about?.llm.model || "…"}`.
    - `.env.example`: after `LLM_API_KEY`, add `# Optional: when the LLM answers 429, the request goes to this OpenRouter model (uses OPENROUTER_API_KEY).` and `LLM_FALLBACK_MODEL=google/gemini-3.5-flash-lite`.
    - `docs/adr/003-llm-provider.md`: add under Decision: "- **2026-11-03: OpenRouter as overflow.** With `LLM_FALLBACK_MODEL` set, a 429 from the primary (quota or rate limit used up) sends the same request to that model on OpenRouter, and the primary is skipped for 60 seconds. The owner chose `google/gemini-3.5-flash-lite`, the same model, so answers match. The answer's footer names the model that actually answered."
    - Fix any existing test this breaks (for example a full-dict check in `backend/tests/test_about.py`).
  - Done when: `make lint` and `make test` pass.
  - Out of scope: falling back on 5xx or timeouts, a fallback for the embedder or reranker, new tests (owner's rule for now).

- [ ] 7.9g Home: a true "With RAG" example
  - Do: in `frontend/app/page.tsx`, the "Same question, both ways" comparison:
    - Question: “How long can my question be here?”
    - Model on its own: “Up to 4,000 characters.” (the "Confident, and made up." line stays).
    - With RAG: “1,000 characters. <cite>1</cite>” (same markup as today).
    - Source line: `[1] Site FAQ · card 2: “…a question at most 1,000 characters…”` (the FAQ's chunk at position 1, shown as card 2 like the Ask page).
  - Done when: `make lint` and `make test` pass.
  - Out of scope: the rest of Home (FAQ wording, the second look on Home).

- [ ] 7.9h Card counts after a second look
  - Do:
    - `frontend/lib/characters.ts`, `secondLookLine`: replace the last sentence with `` ` I keep the best ${look.slots} new cards of that second search, and they join the first search's ${v(about?.judge.keep)}, so the Storyteller gets up to ${look.max_cards}.` ``
    - `storytellerCopy`, setting "Cards used": `` `up to ${v(about?.second_look.enabled ? about.second_look.max_cards : about?.judge.keep)}` ``.
    - `frontend/app/ask/page.tsx`: next to `keptCount`, add
      ```ts
      // After a second look the Storyteller gets the final cards, not just the first round's.
      const handedCount = judge2 && !judge2.check?.nothing ? judge2.finalCards.length : keptCount;
      const foundCount = (scout?.length ?? 0) + (scout2?.results.length ?? 0);
      ```
      Use `handedCount` in place of `keptCount` in `progress`'s Storyteller line, in `storytellerSays(...)` and in `AnswerCard`'s `kept`. Use `foundCount` in that progress line and in `AnswerCard`'s `cardsFound`. The Judge and Scout lines stay on round 1's numbers.
    - Update `frontend/lib/characters.test.ts` line 32 to the new sentence ("…and they join the first search's 5, so the Storyteller gets up to 7.").
  - Done when: `make lint` and `make test` pass.
  - Out of scope: Home's "keeps the best 5", the Judge tab's own lists.

- [ ] 7.9i Second-look cards keep their citation numbers
  - Do: in `frontend/components/ask/StepDetails.tsx`, `JudgeVerdict` takes an optional `offset = 0` and shows `r.n + offset` in each kept row's number (the React key stays `r.n`). The round 2 call passes `offset={judge2.finalCards.filter((c) => c.round === 1).length}`, so the new cards show as 6 and 7, matching "Handed to the Storyteller" and the answer's [n]. Round 1 is unchanged.
  - Done when: `make lint` and `make test` pass.
  - Out of scope: the Storyteller tab's "card N" label.

- [ ] 7.9j The Judge shows its scores and why a card was set aside (after 7.9i)
  - Do: in `frontend/components/ask/StepDetails.tsx`, `JudgeVerdict`:
    - Kept rows: the mono column reads `score 0.90 · was #1` (`rerank_score.toFixed(2)`); when `rerank_score` is `null` (the reranker failed), it stays `was #1`.
    - Set-aside rows: each `<li>` gets the same mono score after the name, when there is one. A set-aside card whose `new_rank` is lower (better) than the highest `new_rank` among the kept cards was skipped by the per-document limit: add the note “2 already from this document” after it (use `about.judge.max_per_document` for the number).
    - Under the "Set aside" heading, one line: round 1 “Only the best {keep} are kept, at most {max_per_document} from one document.”; round 2 “Only the best {slots} new cards are added.” (`JudgeVerdict` takes the line as a prop `rule`; both callers pass it from `useAbout()`, using "…" while it loads).
    - CSS for the score and note in `StepDetails.module.css`, reusing the existing `.mono` and `.empty` styles; no new colours.
  - Done when: `make lint` and `make test` pass.
  - Out of scope: scores on the Scout tab, the "why" of the second look (review fix 6).
- [ ] 7.10 (You) Release review on alt-main
  - Do: deploy `alt-main` as a Vercel preview (and the backend if 7.8 shipped) and check keyboard use, reduced motion, the four sizes, a live run, the example run and a failed request.
  - Done when: the owner signs off on the preview.
- [ ] 7.11 (You) Decide alt-main → main
  - Do: the owner decides whether to merge `alt-main` into `main` as is, in part, or not at all.

## Milestones

- [x] Phase 0: public repo, step skills and protections in place
- [x] Phase 1: both empty pages live, CI green on every PR
- [x] Phase 2: the starter library is live and anyone can paste a private text on the live site
- [x] Phase 3: cited answers on the live site, with a baseline eval score
- [x] Phase 4: hybrid search, Judge and Dependabot shipped (Fact-Checker, LLM-judged evals, evals in CI and tracing skipped)
- [ ] Phase 5: all seven characters animating in the office rooms, a home page that explains RAG and the project, and the vector map with character tabs, the launch library, downloads, PDF highlighting and the second look (data-driven scenes, accessibility and source side panel skipped)
- [ ] Phase 6: launch documents, limits and README done; v1.0.0 released
- [ ] Phase 7: one-screen Ask with the answer first, a recorded example run, honest status and bounded requests; Home and Upload follow it
