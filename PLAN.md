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
- [ ] 2.10 (You) Spend limit
  - Do: set a monthly spend limit (about $10) in the Anthropic Console, before any endpoint that calls Claude goes live.
  - Done when: the limit shows in the Console.

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
- [ ] 3.5 Ask page
  - Do: plain UI with a question box, streamed answer, [n] markers as buttons, and a sources panel showing each cited snippet. Sends the visitor's private chunks with each question.
  - Done when: on the preview URL, every marker opens its source.
  - Out of scope: document view page, characters.
- [ ] 3.6 Document view
  - Do: page `/library/[id]` that scrolls to and highlights the cited chunk when opened from a citation. For a citation to a visitor's own pasted text, show that text from the browser with the cited passage scrolled to and highlighted. Library citations link to the original in `/corpus/` at the cited page.
  - Done when: clicking [2] lands on the cited passage or page, for a library document and for a pasted text.
  - Out of scope: editing or deleting documents, highlighting the exact passage inside a PDF.
- [ ] 3.7 Starter evals
  - Do: 30 questions in `evals/questions.jsonl` (at least 8 about the owner's documents, 5 the library can't answer, 2 aimed at a planted instruction inside a corpus file) and `make eval`, run against a fresh database holding only the starter corpus, reporting retrieval hit rate, citation validity and refusals.
  - Done when: `make eval` prints a score table that is saved as the baseline.
  - Out of scope: LLM-judged metrics, CI workflow.

## Phase 4: Industry extras

Each upgrade has eval scores before and after, pasted into the PR description.

- [ ] 4.1 Hybrid search
  - Do: Scout runs vector and full-text search over the library and merges with reciprocal rank fusion (private chunks stay vector-only); add 5 eval questions built on exact names or codes.
  - Done when: before and after eval scores are in the PR.
  - Out of scope: reranking.
- [ ] 4.2 Judge
  - Do: Scout fetches 20; rerank-3-lite keeps the best 5; step events include each card's old and new rank.
  - Done when: before and after eval scores are in the PR.
  - Out of scope: Fact-Checker.
- [ ] 4.3 Fact-Checker
  - Do: one LLM call through `llm.py` checks each cited claim against its chunk and flags unsupported ones, as a reusable function; off by default, behind a toggle.
  - Done when: a planted wrong claim gets flagged.
  - Out of scope: frontend display beyond the toggle, LLM-judged evals.
- [ ] 4.4 LLM-judged evals
  - Do: faithfulness (reusing the Fact-Checker function) and answer correctness scored by the LLM through `llm.py`, added to `make eval`.
  - Done when: scores look sensible on 3 answers the owner grades.
  - Out of scope: CI workflow.
- [ ] 4.5 Evals in CI
  - Do: `evals.yml` runs on PRs that touch the pipeline or prompts, posts scores as a PR comment, fails when a score drops more than 5 points below baseline (LLM scores are noisy), skips when secrets are missing (forks).
  - Done when: a PR with a deliberately bad prompt fails.
  - Out of scope: new eval questions.
- [ ] 4.6 Tracing
  - Do: send every upload and question to Langfuse with a span per character (inputs, outputs, time, tokens, cost).
  - Done when: one trace shows all steps of a question.
  - Out of scope: error monitoring.
- [ ] 4.7 Dependabot
  - Do: one `.github/dependabot.yml` covering pip, npm and GitHub Actions.
  - Done when: Dependabot shows as enabled in the repo's security tab.
  - Out of scope: CodeQL, release automation, application code.

## Phase 5: Cartoon characters (Figma and Rive)

Rive convention for every character (added to `CLAUDE.md` in step 5.4): one `.riv` file per character in `frontend/public/characters/`; one state machine named `main`; inputs `working` (boolean), `handoff` (trigger), `done` (trigger), `confused` (trigger).

- [ ] 5.1 (You) Figma characters
  - Do: style sheet (palette, line weight) and all 8 characters with separate layers for moving parts.
  - Done when: they look like one cast.
- [ ] 5.2 (You) Figma layouts
  - Do: layouts for the Upload page (workshop) and Ask page (library), including the answer scroll and sources panel.
  - Done when: every UI element from Phases 2 and 3 has a place.
- [ ] 5.3 (You) Figma plugin
  - Do: install the Figma plugin in Claude Code.
  - Done when: `/mcp` shows Figma connected.
- [ ] 5.4 Static layouts
  - Do: add the Rive convention above to `CLAUDE.md`; build both page layouts from the Figma frames with static character images, keeping all existing behaviour.
  - Done when: pages match Figma and existing tests still pass.
  - Out of scope: Rive, animations.
- [ ] 5.5 (You) Rive: first two characters
  - Do: import the Collector and Chopper from Figma, rig them, build the `main` state machine with the agreed inputs.
  - Done when: every input plays in the Rive preview.
- [ ] 5.6 CharacterStage
  - Do: component playing `.riv` files with `@rive-app/react-canvas`, queueing step events, mapping them to inputs, with a minimum on-screen time per scene; wire up the Collector and Chopper on the Upload page.
  - Done when: the first two scenes play in order on a real upload.
  - Out of scope: the other six characters, the Ask page.
- [ ] 5.7 (You) Rive: other six characters
  - Do: rig the rest, plus travelling props (page stack, cards, tag, scroll).
  - Done when: every input plays in the preview.
- [ ] 5.8 Full Upload scene
  - Do: all four handoffs, with the shelf counter rising as chunks come back to the visitor.
  - Done when: one upload plays the whole scene.
  - Out of scope: the Ask page.
- [ ] 5.9 Full Ask scene
  - Do: Translator, Scout with the Archivist pointing, Judge, Storyteller pinning badges, Fact-Checker when enabled, and the "nothing found" scene.
  - Done when: a good question and an unanswerable one both play correctly.
  - Out of scope: character detail panels.
- [ ] 5.10 Character detail panels
  - Do: click a character to see what it did: the Chopper's chunks, the Scout's matches with scores, the Judge's rank changes, the Fact-Checker's verdicts.
  - Done when: each panel shows real data from that question.
  - Out of scope: accessibility work.
- [ ] 5.11 Accessibility
  - Do: reduce-motion mode that swaps animations for a step list, alt text, keyboard access.
  - Done when: the site is usable with motion off and with keyboard only.
  - Out of scope: new features.

## Phase 6: Launch

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
- [ ] Phase 4: hybrid search, Judge, Fact-Checker, evals in CI and tracing shipped
- [ ] Phase 5: all eight characters animating both pages
- [ ] Phase 6: limits and README done; v1.0.0 released
