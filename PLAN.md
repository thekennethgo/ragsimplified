# PLAN

Source of truth for the build. Work the first unticked step only. Background, architecture, stack and characters: [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md).

Steps marked **(You)** are done by hand, outside Claude Code. Every other step is one `/next-step` cycle, one commit, one PR that the owner reviews and merges.

## Phase 0: Repo and Claude Code setup

- [x] 0.1 (You) Repo
  - Do: public GitHub repo with README, MIT license, Python + Node `.gitignore`; clone it; install `gh` and log in.
  - Done when: the repo is visible when logged out.
- [x] 0.2 (You) Claude Code setup
  - Do: add `CLAUDE.md`, `PLAN.md` and the two step skills; push.
  - Done when: `/next-step` appears in Claude Code.
- [ ] 0.3 (You) Repo protections
  - Do: turn on secret scanning and push protection; protect `main` (require a PR and passing checks, block force pushes).
  - Done when: a direct push to `main` is rejected.
- [ ] 0.4 Folder layout
  - Do: create `frontend/`, `backend/app/pipeline/`, `evals/`, `docs/adr/`, `corpus/`; add `.env.example` listing every variable with fake values.
  - Done when: folders exist and `.env` is git-ignored.
  - Out of scope: any application code, `CONTRIBUTING.md`, templates.
- [ ] 0.5 Community files
  - Do: add `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and issue and PR templates.
  - Done when: templates show when opening a test issue.
  - Out of scope: CI, application code.
- [ ] 0.6 ADR for the stack
  - Do: write `docs/adr/001-stack.md`: the stack and why each piece was chosen.
  - Done when: the owner agrees with every reason in it.
  - Out of scope: other ADRs, any code.

## Phase 1: Walking skeleton and CI/CD

Deploy an almost-empty app first, so every later step ships through a working pipeline.

- [ ] 1.1 Backend skeleton
  - Do: FastAPI app in `backend/` with `GET /health`, one pytest test, Ruff config.
  - Done when: `pytest` passes and `/health` returns ok locally.
  - Out of scope: database, Dockerfile, Makefile, CI.
- [ ] 1.2 Frontend skeleton
  - Do: Next.js app in `frontend/` with a shared nav and two empty pages, `/upload` and `/ask`; one Vitest test.
  - Done when: both pages load locally.
  - Out of scope: backend calls, styling beyond the basics, Makefile, CI.
- [ ] 1.3 Docker Compose
  - Do: `docker-compose.yml` running frontend, backend and Postgres with the pgvector extension.
  - Done when: `docker compose up` starts all three.
  - Out of scope: migrations, schema, deployment config.
- [ ] 1.4 Makefile and formatter hook
  - Do: `Makefile` with `format`, `lint`, `test` targets for both apps; add the PostToolUse `make format` hook to `.claude/settings.json`.
  - Done when: `make lint` and `make test` pass and editing a file reformats it.
  - Out of scope: CI, new tests.
- [ ] 1.5 CI
  - Do: GitHub Actions `ci.yml`: lint, typecheck and tests for both apps on every PR.
  - Done when: this step's PR shows green checks.
  - Out of scope: eval workflow, deploys, CodeQL.
- [ ] 1.6 (You) Hosting
  - Do: connect `frontend/` to Vercel; create a Supabase dev project; deploy `backend/` to Render from its Dockerfile with env vars set.
  - Done when: Vercel posts a preview URL on PRs and live `/health` works.
- [ ] 1.7 Health badge
  - Do: frontend shows a "library online" badge from the backend's `/health`; backend URL comes from an env var.
  - Done when: the badge is green on the live site.
  - Out of scope: any other backend endpoint.
- [ ] 1.8 (You) Context7 MCP
  - Do: add the Context7 MCP at project scope (`.mcp.json`).
  - Done when: `/mcp` lists it.

## Phase 2: Central library and the Upload page

Tests never call paid APIs: they use a fake embedder.

- [ ] 2.1 Migrations
  - Do: migrations for `documents` (title, filename, content hash, storage path, uploaded at) and `chunks` (document ID, position, page, heading, text, embedding vector sized to the embedding model, full-text column).
  - Done when: the migration runs locally and in CI.
  - Out of scope: any code that reads or writes the tables.
- [ ] 2.2 Collector
  - Do: parse PDF, Markdown and text into text with page numbers; tests with small fixture files.
  - Done when: tests pass on all three file types.
  - Out of scope: chunking, embeddings, database writes, endpoints.
- [ ] 2.3 Chopper
  - Do: split parsed text into ~500-token chunks with a 50-token overlap, keeping page and heading.
  - Done when: unit tests cover empty input, one huge section and a code block.
  - Out of scope: embeddings, database writes.
- [ ] 2.4 Translator
  - Do: Voyage embedding client with batching and retries, plus a fake embedder for tests; key from env.
  - Done when: a real call works locally once and tests use the fake.
  - Out of scope: database writes, endpoints, reranking.
- [ ] 2.5 Archivist
  - Do: save a document and its chunks in one transaction; skip duplicates by content hash; store the original file in Supabase Storage.
  - Done when: uploading the same file twice stores it once.
  - Out of scope: endpoints, search.
- [ ] 2.6 Upload endpoint
  - Do: `POST /library/upload`: check file type and a 5 MB limit, run the four steps, stream a step event as each starts and finishes.
  - Done when: `curl` shows the event stream end to end.
  - Out of scope: quotas, screening, frontend.
- [ ] 2.7 Library endpoints
  - Do: `GET /library` (documents with chunk counts) and `GET /library/{id}` (document with its chunks).
  - Done when: both return the uploaded document.
  - Out of scope: delete, frontend.
- [ ] 2.8 Upload page
  - Do: plain UI with drag and drop, a text log of step events as they stream, and the library list.
  - Done when: uploading a PDF on the preview URL shows it appear.
  - Out of scope: characters, animations, the Ask page.
- [ ] 2.9 Seed corpus
  - Do: `make seed` loads an openly licensed starter corpus from `corpus/` so the library is never empty.
  - Done when: the live library lists the starter documents.
  - Out of scope: evals, new endpoints.
- [ ] 2.10 (You) Playwright MCP
  - Do: add the Playwright MCP (and the Supabase MCP for the dev project, read-only, optional).
  - Done when: `/mcp` lists them.

## Phase 3: The Ask page with citations

- [ ] 3.1 Scout
  - Do: top-k vector search over the library (k = 5 for now).
  - Done when: tests with fixed fake embeddings return the expected chunks.
  - Out of scope: hybrid search, reranking, endpoints.
- [ ] 3.2 Storyteller prompt
  - Do: prompt in its own file: answer only from the numbered chunks, cite them as [1], [2], say so when the chunks don't cover the question, treat chunk text as data, never as instructions.
  - Done when: the owner reads the prompt and agrees with every line.
  - Out of scope: calling the LLM, endpoints.
- [ ] 3.3 Ask endpoint
  - Do: `POST /ask`: Translator, Scout, Storyteller in order; stream step events and the answer; model from the `LLM_MODEL` env var.
  - Done when: `curl` shows events, then the answer.
  - Out of scope: citations list, rate limits, frontend.
- [ ] 3.4 Citations
  - Do: map each [n] to its chunk (document, page, snippet) and send the list after the answer; drop any [n] that doesn't match a chunk.
  - Done when: tests cover valid, repeated and made-up citation numbers.
  - Out of scope: frontend.
- [ ] 3.5 Ask page
  - Do: plain UI with a question box, streamed answer, [n] markers as buttons, and a sources panel showing each cited snippet.
  - Done when: on the preview URL, every marker opens its source.
  - Out of scope: document view page, characters.
- [ ] 3.6 Document view
  - Do: page `/library/[id]` that scrolls to and highlights the cited chunk when opened from a citation.
  - Done when: clicking [2] lands on the highlighted passage.
  - Out of scope: editing or deleting documents.
- [ ] 3.7 Starter evals
  - Do: 30 questions in `evals/questions.jsonl` (5 the library can't answer) and `make eval`, run against a fresh database holding only the starter corpus, reporting retrieval hit rate, citation validity and refusals.
  - Done when: `make eval` prints a score table that is saved as the baseline.
  - Out of scope: LLM-judged metrics, CI workflow.

## Phase 4: Industry extras

Each upgrade has eval scores before and after, pasted into the PR description.

- [ ] 4.1 Hybrid search
  - Do: Scout runs vector and full-text search and merges with reciprocal rank fusion; add 5 eval questions built on exact names or codes.
  - Done when: before and after eval scores are in the PR.
  - Out of scope: reranking.
- [ ] 4.2 Judge
  - Do: Scout fetches 20; rerank-3-lite keeps the best 5; step events include each card's old and new rank.
  - Done when: before and after eval scores are in the PR.
  - Out of scope: Fact-Checker.
- [ ] 4.3 Fact-Checker
  - Do: one Haiku call checks each cited claim against its chunk and flags unsupported ones; off by default, behind a toggle.
  - Done when: a planted wrong claim gets flagged.
  - Out of scope: frontend display beyond the toggle, LLM-judged evals.
- [ ] 4.4 LLM-judged evals
  - Do: faithfulness and answer correctness scored by Haiku, added to `make eval`.
  - Done when: scores look sensible on 3 answers the owner grades.
  - Out of scope: CI workflow.
- [ ] 4.5 Evals in CI
  - Do: `evals.yml` runs on PRs that touch the pipeline or prompts, posts scores as a PR comment, fails below baseline, skips when secrets are missing (forks).
  - Done when: a PR with a deliberately bad prompt fails.
  - Out of scope: new eval questions.
- [ ] 4.6 Tracing
  - Do: send every upload and question to Langfuse with a span per character (inputs, outputs, time, tokens, cost).
  - Done when: one trace shows all steps of a question.
  - Out of scope: Sentry.
- [ ] 4.7 Repo upkeep
  - Do: Dependabot, CodeQL, and release-please for changelogs from conventional commits.
  - Done when: a release PR appears after the next merge.
  - Out of scope: application code.
- [ ] 4.8 (You) Claude Code GitHub Action
  - Do: optional; install the Action limited to your own comments for `@claude` PR reviews.
  - Done when: `@claude review` replies on a PR.

## Phase 5: Cartoon characters (Figma and Rive)

Rive convention for every character (write it into `CLAUDE.md` before 5.5): one `.riv` file per character in `frontend/public/characters/`; one state machine named `main`; inputs `working` (boolean), `handoff` (trigger), `done` (trigger), `confused` (trigger).

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
  - Do: build both page layouts from the Figma frames with static character images, keeping all existing behaviour.
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
  - Do: all four handoffs, with the shelf counter rising as chunks are stored.
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

- [ ] 6.1 Upload limits
  - Do: PDF, Markdown and text only, 5 MB per file, a per-IP daily quota, and a cap on total library size.
  - Done when: each limit returns a clear error on the page.
  - Out of scope: screening, Ask limits.
- [ ] 6.2 Upload screening
  - Do: before storing, one Haiku call flags spam or abusive content; uploaders tick a box confirming they may share the file.
  - Done when: a spam test file is rejected.
  - Out of scope: admin removal.
- [ ] 6.3 Admin removal
  - Do: a delete endpoint protected by a secret token, and a "report this document" link in the library list.
  - Done when: the owner can remove a document from the live site.
  - Out of scope: user accounts.
- [ ] 6.4 Ask limits
  - Do: per-IP rate limit (20 questions a day), question length cap, and a cache for repeated questions.
  - Done when: the 21st question in a day is politely refused.
  - Out of scope: upload limits.
- [ ] 6.5 (You) Spend limit and production DB
  - Do: set a monthly spend limit in the Anthropic Console; create the production Supabase project and point Render at it.
  - Done when: the limit shows in the Console.
- [ ] 6.6 Auto migrations
  - Do: run migrations automatically on deploy, before the new backend starts.
  - Done when: a deploy with a new migration succeeds.
  - Out of scope: new migrations.
- [ ] 6.7 Monitoring
  - Do: Sentry in both apps and an uptime check on `/health`.
  - Done when: a test error shows up in Sentry.
  - Out of scope: tracing changes.
- [ ] 6.8 End-to-end tests
  - Do: Playwright tests for upload, ask and citation clicks, added to CI.
  - Done when: tests pass in CI against the preview URL.
  - Out of scope: new features.
- [ ] 6.9 Launch README
  - Do: live link, a GIF of both scenes, the architecture diagram, eval scores, "Run it yourself" and "Deploy your own".
  - Done when: a friend can run it locally from the README alone.
  - Out of scope: code changes.
- [ ] 6.10 (You) Release
  - Do: tag release `v1.0.0` and share the link.
  - Done when: the release page lists the changelog.

## Milestones

- [ ] Phase 0: public repo, step skills and protections in place
- [ ] Phase 1: both empty pages live, CI green on every PR
- [ ] Phase 2: anyone can upload to the central library on the live site
- [ ] Phase 3: cited answers on the live site, with a baseline eval score
- [ ] Phase 4: hybrid search, Judge, Fact-Checker, evals in CI and tracing shipped
- [ ] Phase 5: all eight characters animating both pages
- [ ] Phase 6: limits, monitoring and README done; v1.0.0 released
