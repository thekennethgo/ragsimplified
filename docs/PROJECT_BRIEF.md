# RAG Characters Project Plan

Oct 4, 2026 · @Kenneth Go

## Overview

You'll build a public, forkable RAG web app with two pages that share one owner-curated library: an **Upload** page where cartoon characters turn text a visitor pastes into searchable cards that stay private to them, and an **Ask** page where they find the right cards and write a cited answer. It runs on free tiers plus about $5 to $10 of Anthropic API credits.

**Goals**

- A live site anyone can use: paste some text of your own (kept private in your browser, never stored on the server), then ask questions about it and the starter library together.
- Every answer carries clickable citations that open the exact source passage.
- A starter library, curated by the owner, that holds the owner's own CV, experience and public contact details, so visitors can ask about them right away.
- Cartoon characters that interact on screen, so each RAG step is visible.
- A public repo that shows professional SWE habits and a pipeline that mirrors industry RAG.

**How you'll build it:** about 55 small steps, each one a single Claude Code cycle that you review before the next begins. Opus plans each step, Sonnet carries it out, and you approve it.

## Working with Claude Code

Sonnet sticks to a plan best when the plan lives in a file with tiny steps and a clear "done when", and when the rules that must always hold are enforced by tools rather than by trust. No setting guarantees it will follow instructions exactly, but this setup makes drift rare and easy to spot in review.

**What `opusplan` does:** Claude Code uses Opus while you're in plan mode and switches to Sonnet when you approve the plan and it starts editing ([docs](https://code.claude.com/docs/en/model-config)). Start every session with `claude --model opusplan`.

**The loop for every step**

1. Run `/clear` so each step starts with a clean context. `CLAUDE.md` and `PLAN.md` carry everything Claude needs to remember.
2. Press Shift+Tab until you're in plan mode, then run `/next-step`. Opus reads `PLAN.md`, picks the first unticked step, and proposes a plan for that step only.
3. Read the plan. Ask questions or correct it. Approve it only when it matches the step.
4. Sonnet implements it, runs lint and tests, and stops with a report.
5. Check the result yourself, using the step's "You check" column.
6. Run `/ship-step`. Sonnet ticks the step, commits, pushes a branch and opens a PR. Merge it once CI is green.

Keep Claude Code in its default permission mode, which asks before each file edit, so you see every change as it happens. Don't turn on auto-accept for this project.

**`PLAN.md`** is the build plan from this doc in a file. Export this doc to Markdown and copy the Phase 0 to Phase 6 sections into it. Each step is one checkbox line with three parts:

```markdown
- [ ] 2.3 Chopper
  - Do: split parsed text into ~500-token chunks with a 50-token overlap, keeping page number and heading.
  - Done when: unit tests cover empty input, one huge section, and a code block.
  - Out of scope: embeddings, database writes.
```

**`CLAUDE.md`** opens with these working rules, above the stack, commands and character map:

```markdown
## Working rules (follow strictly)
- PLAN.md is the source of truth. Work only on the first unticked step.
- Do exactly what that step says. No extra features, refactors or unrelated fixes.
- If the step is unclear, conflicts with the code, or needs a decision, stop and ask. Never guess.
- Before you finish, run `make lint` and `make test`.
- Finish with a report: files changed, how to verify, anything you were unsure about.
- Never tick a step, commit or push until I run /ship-step.
- Never commit secrets. Read every key from environment variables.
```

**`.claude/skills/next-step/SKILL.md`** starts each cycle:

```markdown
---
description: Plan the next unticked step in PLAN.md
disable-model-invocation: true
---
1. Read PLAN.md and name the first unticked step (number and title).
2. Plan that step only: files to create or change, tests to add, and how I can check it.
3. Quote the step's "Out of scope" line and confirm you'll respect it.
4. Wait for my approval. After approval, implement, run make lint and make test, then stop and report.
5. Do not start the next step.
```

**`.claude/skills/ship-step/SKILL.md`** closes it:

```markdown
---
description: Tick the current step, commit it and open a PR
disable-model-invocation: true
---
1. Tick the current step in PLAN.md.
2. Create a branch named step-<number>-<short-name>.
3. Commit with a conventional commit message (feat:, fix:, chore:, test:, docs:) that names the step.
4. Push and open a PR with gh, summarising what changed and how it was checked.
```

`disable-model-invocation: true` means only you can trigger these skills; Claude can't run them on its own ([docs](https://code.claude.com/docs/en/skills)).

**Rules that must always hold go in hooks.** From step 1.4 on, a hook runs `make format` after every edit, so formatting never depends on Claude remembering it:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [ { "type": "command", "command": "make format" } ] }
    ]
  }
}
```

## MCP servers and skills

You need only two additions to start: the Figma plugin and your own two step skills. Add the rest when the phase that uses them begins; every extra tool adds context and another thing to debug.

| Tool | What it's for | When | Setup |
| --- | --- | --- | --- |
| `/next-step` and `/ship-step` | The step loop above | Phase 0 | Your own project skills in `.claude/skills/` |
| GitHub CLI (`gh`) | PRs, CI status, issues | Phase 0 | Install `gh` and run `gh auth login`; Claude uses it directly, no MCP needed |
| [Figma plugin](https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server) | Lets Claude read your frames, colors and spacing to build matching layouts | Phase 5 | `claude plugin install figma@claude-plugins-official`, then authenticate via `/mcp` |
| Context7 MCP | Up-to-date docs for Next.js, FastAPI, pgvector and the Rive runtime, so Sonnet doesn't use outdated APIs | Phase 1 | Add it at project scope so it's in `.mcp.json` |
| Built-in `/code-review` | A second look at the diff before `/ship-step` | Any time | Built in |

**Skip:** a Rive MCP (you animate in the Rive editor yourself; Claude only writes the code that plays your `.riv` files), the Playwright and Supabase MCPs, extra database or deploy MCPs (Vercel and Render deploy from GitHub on their own), and the Claude Code GitHub Action.

## Tech stack and spending

Only the LLM costs money; a demo with 1,000 questions a month runs about $10, and a monthly spend limit in the Anthropic Console (step 2.10) caps it. Free-tier limits change often, so check each one when you sign up.

| Layer | Tool | Cost |
| --- | --- | --- |
| LLM (Storyteller, Fact-Checker) | Claude Haiku 4.5 via the [Anthropic API](https://benchlm.ai/anthropic/api-pricing) | $1 per 1M input tokens, $5 per 1M output. **Required: about $5 to $10 of prepaid credits** |
| Embeddings (Translator) | [Voyage AI](https://docs.voyageai.com/docs/pricing) voyage-4 | Free: first 200M tokens per account |
| Reranker (Judge) | Voyage rerank-3-lite | Free: first 200M tokens per account |
| Central library (Archivist, Scout) | Supabase Postgres with pgvector and full-text search. Owner-curated and read-only at runtime. Only the chunks are stored, not the original files. Visitor uploads are never stored | Free tier (free projects pause after about a week idle) |
| Backend API | Python FastAPI on Render, native Python runtime (no Docker image) | Free tier, sleeps when idle. Optional: about $7/month to avoid cold starts |
| Frontend | Next.js on Vercel (Hobby plan) | Free for non-commercial use |
| CI/CD | GitHub Actions | Free for public repos |
| Tracing | Langfuse Cloud | Free tier |
| Character animation | Rive (Lottie as the fallback) | Free plan; check its current export limits |
| Domain name | Any registrar | Optional, about $10 to $15/year |

**Cost estimate per question:** about 4,000 input and 400 output tokens, so roughly $0.006. The Fact-Checker roughly doubles that to about $0.01. One eval run of 40 questions costs about $0.50.

**Model choice:** keep the model ID in an environment variable (`LLM_MODEL`), not in code. Haiku 4.5 is the cheapest current Claude model today, but models get retired, and a config change beats a code change.

## System architecture

The Upload and Ask pages are separate routes in one Next.js app, and both talk to one FastAPI backend. The backend reads the owner-curated central library in Postgres; a visitor's pasted text is chunked, embedded and returned to their browser, never stored (ADR 002).

| Endpoint | Page | Returns |
| --- | --- | --- |
| `POST /upload` | Upload | Takes a title and pasted text; returns a stream of step events (Chopper, Translator), then the chunks and vectors for the browser to keep. Writes nothing |
| `GET /library` | Upload | Every starter document with its chunk count |
| `POST /ask` | Ask | Takes the question and the visitor's private chunks; returns a stream of step events, the answer text, then the citation list |
| `GET /library/{id}` | Document view | The document's chunks, so a citation can scroll to and highlight its passage |

Both pipelines stream **step events** over server-sent events (for example `chopper.done` with the chunk count). The frontend turns each event into a character animation, so the cartoons stay in sync with the real work.

&#91;embedded content: System architecture · offline ingest and live question paths\]

The owner fills the library through the top path (`make seed`); every question runs the bottom path against the library plus the visitor's own chunks. A citation points to a chunk, so the Ask page can open the source: a starter document in the document view, or the visitor's own pasted text with the passage highlighted. (The diagram above still shows visitor uploads filling the library and should be redrawn.)

## The characters

Eight cartoon characters each own one pipeline step, and every handoff between steps is a moment where two of them interact on screen. Each character is also one module in `backend/app/pipeline/`, so the code matches the story. The looks below are suggestions; you design them in Figma.

| Character | Cartoon idea | RAG step | Implementation | Page |
| --- | --- | --- | --- | --- |
| Collector | Mail carrier with a bulging satchel | Ingestion | Parses PDF, Markdown and text; keeps page numbers. Runs in the seed script for the owner's files | Seed |
| Chopper | Chef with a cleaver | Chunking | \~500-token chunks, 50-token overlap, keeps heading and page | Upload |
| Translator | Linguist with a glowing stamp | Embedding | voyage-4, for chunks and for questions | Both |
| Archivist | Owl librarian | Storage (the central library) | Postgres + pgvector (vectors, full text and chunk text); written only by the seed script | Ask |
| Scout | Explorer with a lantern | Retrieval | Vector search, then hybrid (vector + keyword) in Phase 4 | Ask |
| Judge | Judge with a gavel | Reranking | rerank-3-lite keeps the best 5 of 20 | Ask |
| Storyteller | Writer with a quill | Generation with citations | Haiku answers only from numbered chunks and cites them as \[1\], \[2\] | Ask |
| Fact-Checker | Detective with a magnifying glass | Grounding check | Haiku checks each cited claim against its chunk | Ask |

**Upload page scenes** (a workshop that prepares a private shelf for the visitor)

1. The pasted text arrives as a scroll; the Chopper catches it. (The Collector now works only on the owner's files, in the seed script.)
2. The Chopper slices the pages into cards and slides them down the counter. The card count appears above the pile.
3. The Translator stamps each card with a glowing tag (its embedding) and passes it on.
4. The tagged cards are handed back to the visitor, who keeps them on a personal shelf; the shelf counter ticks up and the text joins "your texts". (Nothing goes to the shared library.)

**Ask page scenes** (inside the library)

1. The question arrives as a paper plane; the Translator stamps it with a tag.
2. The Scout shows the tag to the Archivist, who points to the right shelves. The Scout runs off and returns with an armful of 20 cards.
3. The Judge inspects the cards, tosses most aside, and lines up the best 5 with numbered badges.
4. The Storyteller writes the answer on a scroll, pinning a numbered badge wherever a card is used.
5. The Fact-Checker checks each pin against its card: a green tick, or a red flag on an unsupported claim.
6. The scroll is delivered; the badges become clickable citations that open the source passage.

**When nothing matches:** the Scout returns empty-handed and shrugs, and the Storyteller writes that the library doesn't cover the question. This scene shows users that good RAG doesn't make things up.

### What each character shows on screen

The rule: **every visual is driven by real data from the step events, and anything that is only an illustration is labelled as one on screen.** A character that only plays a canned animation teaches nothing; one that shows the real chunks, words and scores does.

| Character | What it does on screen | The real data behind it |
| --- | --- | --- |
| Collector (seed script only) | Loads files onto the owl's cart: a PDF opens, pages flip, page numbers tick. Shown on an optional "how the library was built" view | The pages the Collector parsed (count, page numbers) |
| Chopper | A chef cuts the pasted scroll on a board. Each cut lands where the real chunk boundary is. Neighbouring cards visibly share a coloured strip of text, the overlap. Each card shows its heading and size | Chunk positions, headings, lengths, overlap length (step 4.8) |
| Translator | **Questions:** the question's words sit on a strip; the linguist presses the stamp and the words glow brighter in proportion to how much each one shaped the meaning, found by removing each word in turn and measuring how far the vector moves. **Chunks:** each card gets a fingerprint, a row of bars whose heights are the first 32 numbers of its real vector, so cards with similar meaning look alike | Word influence weights (step 4.8) and the vectors already returned by `/upload` |
| Archivist | The library as a building: a shelf per document, a book per chunk. The owl points to the shelves the Scout is asking about and keeps the counts (documents, chunks) | `GET /library` and the Scout's results |
| Scout | Walks into the library with a lantern over the **vector map**. The question appears as a marker; the lantern's light spreads and lights up the nearest books. Finds made by meaning and finds made by matching words are different colours; a book found both ways glows in both. Lines run from the question to each candidate with its score. The visitor's own chunks light up in their own region | Vector and keyword ranks, scores, matched words, map points (steps 4.8, 4.9) |
| Judge | The twenty candidates stand in a row; the judge reads each, bangs the gavel, and reorders them. Cards slide from their old rank to their new one, with a score bar each; the rejected ones fade. This is what makes reranking visible | Old and new ranks and scores (step 4.2) |
| Storyteller | A quill writes the answer on a scroll as it streams. Each time it cites a card, the numbered badge pins to the sentence and a thread connects it to the card, which opens in the side panel with the passage highlighted | The answer stream, the citations list |
| Fact-Checker | A magnifying glass sweeps each cited sentence, compares it with its card and stamps a green tick or a red flag; an unsupported sentence is underlined with the reason | The Fact-Checker's verdicts (step 4.3) |

**The vector map.** Every chunk is a list of 1024 numbers, which cannot be drawn directly. The map flattens them to two dimensions with PCA, fitted once when the library is seeded, so chunks about similar things sit near each other: Apple articles in one area, Star Wars in another. The map is the library's floor plan, and it is the backdrop for the Scout. Be honest about its limits on screen: it is a flat shadow of a 1024-dimension space, so distances are approximate and two points that look close may not be. The visitor's own pasted chunks are projected with the same stored projection and appear in a separate region ("your shelf"), and each question appears as a marker.

**Not real, so not shown as real.** The embedding of a chunk is one vector for the whole chunk; there is no per-word value inside it. That is why chunks get a fingerprint and not word highlights. The word highlights on a question are an influence measurement made by removing words (extra, cheap embeddings of the same short question), not a view inside the model. If the UI ever shows word chips on a chunk, they must be labelled "illustration".

Scenes are driven by the step events from the backend. The frontend queues events and gives each scene a minimum on-screen time, about a second, so fast steps are still watchable.

## Phase 0: Repo and Claude Code setup

Each row below is one step: one `/next-step` cycle, one commit, one PR. Steps marked **You** are done by hand, outside Claude Code. Copy these tables into `PLAN.md` as checkbox lines (see the format above).

| Step | Who | Do | You check |
| --- | --- | --- | --- |
| 0.1 | You | Create the public GitHub repo with a README, MIT license and Python + Node `.gitignore`. Clone it. Install `gh` and log in. | The repo is visible when logged out |
| 0.2 | You | Add `CLAUDE.md`, `PLAN.md` and the two step skills from "Working with Claude Code". Commit and push to `main`. | `/next-step` appears in Claude Code |
| 0.3 | You | Turn on secret scanning and push protection. Protect `main`: require a PR and block force pushes. Required status checks are added in 1.5, once CI exists. | A direct push to `main` is rejected |
| 0.4 | Sonnet | Create the folder layout: `frontend/`, `backend/app/pipeline/`, `evals/`, `docs/adr/`, `corpus/`. Add `.env.example` listing every variable with fake values. | Folders exist; `.env` is git-ignored |
| 0.5 | Sonnet | Add a short `CONTRIBUTING.md` (how to run it, how to open a PR, the PLAN-driven workflow). | The file exists and is linked from the README |
| 0.6 | Sonnet | Write `docs/adr/001-stack.md`: the stack and why each piece was chosen, and what was left out on purpose (a Storage bucket for original files, Docker images for the apps, Sentry, an ORM or migration framework, end-to-end browser tests). Record these decisions: plain `.sql` migration files applied by a small script; the original upload is not kept, only its chunks; embedding vectors are 1024 dimensions; Render deploys with its native Python runtime. | You agree with every reason in it |
| 0.7 | Sonnet | Write `docs/adr/002-owner-curated-library.md`. Record: the shared library is owner-curated and read-only at runtime (only `make seed` writes it, and the Collector is used only there); visitors paste text instead of uploading files, with a title and a 20,000-character limit, so the backend never parses a visitor's file; a visitor's pasted text is private: the backend chunks and embeds it, returns the chunks and vectors to the browser and stores nothing; the browser keeps the text, chunks and vectors, and sends the chunks with each question; a citation to a visitor's own text highlights the exact passage in the browser; at runtime the backend writes only the `usage` table. Record the rejected options (file uploads of a few MB, per-session database rows with expiry, re-embedding on every question, no database at all) and the costs (no PDF upload and no page numbers for private text, text lost when the tab closes unless kept in IndexedDB, text still reaches Voyage and Anthropic). Also reword one line in `docs/adr/001-stack.md`: the server does not keep the original upload, only its chunks. | You agree with every reason in it |

## Phase 1: Walking skeleton and CI/CD

Deploy an almost-empty app first, so every later step ships through a working pipeline. By the end, the live site has both pages and talks to the live backend.

| Step | Who | Do | You check |
| --- | --- | --- | --- |
| 1.1 | Sonnet | FastAPI app in `backend/` with `GET /health`, one pytest test, Ruff config, `requirements.txt`. | `pytest` passes; `/health` returns ok locally |
| 1.2 | Sonnet | Next.js app in `frontend/` with a shared nav and two empty pages, `/upload` and `/ask`. One Vitest test. | Both pages load locally |
| 1.3 | Sonnet | `docker-compose.yml` with one service: Postgres using the `pgvector/pgvector:pg16` image, port and credentials matching `.env.example`. | `docker compose up` starts a database where `CREATE EXTENSION vector;` succeeds |
| 1.4 | Sonnet | `Makefile` with `format`, `lint`, `test` targets for both apps. Add the formatter hook to `.claude/settings.json`. | `make lint` and `make test` pass; editing a file reformats it |
| 1.5 | Sonnet | GitHub Actions `ci.yml`: lint and tests for both apps on every PR, plus `tsc` for the frontend and a `pgvector/pgvector:pg16` service container for later database tests. Then mark the CI job as a required check on `main`. | This step's PR shows green checks |
| 1.6 | You | Connect `frontend/` to Vercel. Create one Supabase project (free) and enable the `vector` extension. Deploy `backend/` to Render's free web service with the native Python runtime (build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`) with env vars set. | Vercel posts a preview URL on PRs; live `/health` works |
| 1.7 | Sonnet | Frontend shows a "library online" badge from the backend's `/health`. Backend URL comes from an env var. | The badge is green on the live site |
| 1.8 | You | Add the Context7 MCP at project scope. | `/mcp` lists it |

## Phase 2: Central library and the Upload page

By the end, the owner's starter library is live, and anyone can paste a private text on the live site and see it appear under "your texts". The shared library is read-only at runtime. The page is plain for now; characters arrive in Phase 5. Tests never call paid APIs: they use a fake embedder.

| Step | Who | Do | You check |
| --- | --- | --- | --- |
| 2.1 | Sonnet | Plain `.sql` files in `backend/migrations/` and a small `backend/app/migrate.py` (psycopg) that applies unapplied files in order and records them; `make migrate`. Tables: `documents` (title, filename, content hash, uploaded at) and `chunks` (document ID, position, page, heading, text, `embedding vector(1024)`, full-text column with a GIN index, and an HNSW index on the embedding). | `make migrate` works locally and runs in CI against the service container |
| 2.2 | Sonnet | Collector: parse PDF, Markdown and text into text with page numbers. Tests with small fixture files. | Tests pass on all three file types |
| 2.3 | Sonnet | Chopper: \~500-token chunks with a 50-token overlap, keeping page and heading. | Tests cover empty input, one huge section and a code block |
| 2.4 | Sonnet | Translator: embedding client with batching and retries, plus a fake embedder for tests. Key from env. | Real call works locally once; tests use the fake |
| 2.5 | Sonnet | Archivist: save a document and its chunks in one transaction; skip duplicates by content hash. The original file is not stored. Used only by the seed script, never by an upload endpoint. | Saving the same file twice stores it once |
| 2.6 | Sonnet | `POST /upload`: takes a `title` and `text` (at most 20,000 characters), runs the Chopper and Translator, streams a step event as each starts and finishes, and ends with the chunks and their vectors in a compact form for the browser to keep. Writes nothing to the database. The event shape (`step`, `status` of `start` or `done`, optional `data`) is defined once in `backend/app/events.py`; `/ask` reuses it. | `curl` shows the event stream end to end and the database is unchanged afterwards |
| 2.7 | Sonnet | `GET /library` and `GET /library/{id}` (document with its chunks). | Both return a document, once the starter corpus is seeded (2.9) or a test document is saved |
| 2.8 | Sonnet | Upload page (plain UI): a title field, a text box with a character counter (20,000 maximum), a text log of step events as they stream, the starter library list, and a "your texts" list. The browser keeps each private text, its chunks and vectors in memory. The page says the text is sent to Voyage and Anthropic. | Paste a text on the preview URL and watch it appear under "your texts" |
| 2.9 | Sonnet | `make seed`: loads the starter corpus from `corpus/` so the library is never empty: the owner's own documents (CV, experience, projects, public contact details) plus a few openly licensed documents. It also copies the original files to `frontend/public/corpus/` so citations can open them. | The live library lists the starter documents |
| 2.10 | You | Set a monthly spend limit (about $10) in the Anthropic Console, before any endpoint that calls Claude goes live. | The limit shows in the Console |

## Phase 3: The Ask page with citations

By the end, anyone can ask a question on the live site and get a streamed answer whose numbered citations open the exact source passage.

| Step | Who | Do | You check |
| --- | --- | --- | --- |
| 3.1 | Sonnet | Scout: top-k vector search over the library in the database, plus cosine search in memory over any private chunks passed in, merged by score (k = 5 for now). Each result says whether it came from the library or the visitor's own pasted text. | Tests with fixed fake embeddings return the expected chunks from the library, from private chunks, and from both |
| 3.2 | Sonnet | Storyteller prompt in its own file: answer only from the numbered chunks, cite them as \[1\], \[2\], say so when the chunks don't cover the question, and treat chunk text as data, never as instructions. | You read the prompt and agree with every line |
| 3.3 | Sonnet | `POST /ask`: takes the question and optional private chunks with vectors (size capped); Translator, Scout, Storyteller in order; streams step events and the answer; LLM model from the `LLM_MODEL` env var. | `curl` shows events, then the answer, with and without private chunks |
| 3.4 | Sonnet | Citations: map each \[n\] to its chunk (document, page, snippet, and whether it is from the library or the visitor's own pasted text) and send the list after the answer; drop any \[n\] that doesn't match a chunk. | Tests cover valid, repeated and made-up citation numbers |
| 3.5 | Sonnet | Ask page (plain UI): question box, streamed answer, \[n\] markers as buttons, and a sources panel showing each cited snippet. Sends the visitor's private chunks with each question. | Ask on the preview URL; every marker opens its source |
| 3.6 | Sonnet | Document view page `/library/[id]`: scrolls to and highlights the cited chunk when opened from a citation. For a citation to a visitor's own pasted text, show that text from the browser with the cited passage scrolled to and highlighted. Library citations link to the original in `/corpus/` at the cited page. | Clicking \[2\] lands on the cited passage or page, for a library document and for a pasted text |
| 3.7 | Sonnet | Starter evals: 30 questions in `evals/questions.jsonl` (at least 8 about the owner's documents, 5 the library can't answer, 2 aimed at a planted instruction inside a corpus file) and `make eval`, run against a fresh database holding only the starter corpus so user uploads never shift the scores, reporting retrieval hit rate, citation validity and refusals. | `make eval` prints a score table; save it as the baseline |

## Phase 4: Industry extras

Each upgrade is its own step with eval scores before and after; paste both into the PR description. That before-and-after evidence is what AI engineering reviewers look for.

| Step | Who | Do | You check |
| --- | --- | --- | --- |
| 4.1 | Sonnet | Scout upgrade, hybrid search: run vector and full-text search over the library and merge with reciprocal rank fusion (k=60; keyword search is an OR query ranked by `ts_rank_cd`; private chunks join the vector list and have no keyword rank). Add 5 eval questions built on exact names or codes. | Eval scores before and after are in the PR |
| 4.2 | Sonnet | Judge: the Scout fetches 20; rerank-3-lite keeps the best 5. Private chunks are reranked in the same pool. Step events include each card's old and new rank; if the reranker fails, fall back to the fused top 5. | Eval scores before and after are in the PR |
| 4.3 | Sonnet | (Skipped for now) Fact-Checker: one Haiku call checks each cited claim against its chunk and flags unsupported ones, as a reusable function. Off by default, behind a toggle. | A planted wrong claim gets flagged |
| 4.4 | Sonnet | (Skipped for now) LLM-judged evals: faithfulness (reusing the Fact-Checker function) and answer correctness scored by Haiku, added to `make eval`. | Scores look sensible on 3 answers you grade yourself |
| 4.5 | Sonnet | (Skipped for now) `evals.yml` in GitHub Actions: runs on PRs that touch the pipeline or prompts, posts scores as a PR comment, fails when the retrieval hit rate or citation validity drops more than 5 points below the baseline (no LLM-judged scores while 4.3 and 4.4 are skipped), skips when secrets are missing (forks). | A PR with a deliberately bad prompt fails |
| 4.6 | Sonnet | (Skipped for now) Tracing: send every upload and question to Langfuse with a span per character (inputs, outputs, time, tokens, cost). | One trace shows all steps of a question |
| 4.7 | Sonnet | Dependabot: one `.github/dependabot.yml` covering pip, npm and GitHub Actions. | Dependabot shows as enabled in the repo's security tab |
| 4.8 | Sonnet | Visual data in step events: the Chopper reports chunk boundaries and overlaps, the Translator reports each question word's influence (leave-one-out, one batch), the Scout reports vector and keyword ranks, scores and matched words per result. | Tests cover each field; `curl` shows them |
| 4.8a | Sonnet | Placeholder Ask scene (frontend only, no art): labelled placeholder characters in a row beside a mock library, the question typed into a bubble above the Translator with its words highlighted by real influence weights, each character's state from the step events, the answer as a Storyteller chat bubble, and a simple citations sidebar opened by clicking it. Real characters replace the placeholders in Phase 5. | On the preview URL a question types in, highlights, shows states and answer, and the sidebar opens |
| 4.9 | Sonnet | Vector map data: `make seed` fits a 2-D PCA over the library's vectors and stores the projection and every chunk's point; `GET /map` returns them; `/ask` and `/upload` return the question's and the new chunks' points. | Chunks of one document land closer together than chunks of different documents |

## Phase 5: Cartoon characters (Figma and Rive)

You draw and animate; Sonnet builds the pages and wires your animations to the step events. Start with two characters end to end before making all eight, so you find problems with the Rive setup early.

**One Rive convention for every character** (agree on it before 5.5; step 5.4 writes it into `CLAUDE.md`):

- One `.riv` file per character, in `frontend/public/characters/`.
- One state machine named `main`.
- Inputs: `working` (boolean), `handoff` (trigger), `done` (trigger), `confused` (trigger, for the "nothing found" scene).

| Step | Who | Do | You check |
| --- | --- | --- | --- |
| 5.1 | You | Figma: a style sheet (palette, line weight) and all 8 characters, each with separate layers for parts that move (eyes, mouth, arms, props), plus the props from "What each character shows on screen" (cleaver, glowing stamp, lantern with a separate light cone, gavel, quill, magnifying glass, book and card shapes, the owl's shelves). | They look like one cast |
| 5.2 | You | Figma: layouts for the Upload page (a workshop) and the Ask page (a library), including the answer scroll, the sources panel, the vector map (a large panel that works as the library's floor plan, with a legend and a hover card), the strip where the question's words are shown, and the rank lists for the Judge. | Every UI element from Phases 2 and 3, and every visual in "What each character shows on screen", has a place |
| 5.3 | You | Install the Figma plugin in Claude Code. | `/mcp` shows Figma connected |
| 5.4 | Sonnet | Add the Rive convention above to `CLAUDE.md`. Build both page layouts from the Figma frames with static character images, keeping all existing behaviour. | Pages match Figma; existing tests still pass |
| 5.5 | You | Rive: import the Collector and Chopper from Figma, rig them, and build the `main` state machine with the agreed inputs. | Every input plays in the Rive preview |
| 5.6 | Sonnet | `CharacterStage` component: plays `.riv` files with `@rive-app/react-canvas`, queues step events, maps them to inputs, and gives each scene a minimum on-screen time. Wire up the Collector and Chopper on the Upload page. | The first two scenes play in order on a real upload |
| 5.7 | You | Rive: the other six characters, plus props that travel between them (page stack, cards, tag, scroll). | Every input plays in the preview |
| 5.7a | Sonnet | Vector map component: draws the library's points from `GET /map`, coloured by document, with a legend, hover cards, zoom and pan, the visitor's own chunks as a separate group, the question as a marker, and highlighted points with lines from the question. Labelled as a flattened picture. | Component tests pass; the map shows the live library on the Ask page |
| 5.8 | Sonnet | Full Upload scene: all four handoffs, with the shelf counter rising as chunks come back to the visitor. The Chopper's cuts land at the real chunk boundaries with the overlap shown, the Translator stamps each card with a fingerprint from its real vector, and the cards fly onto the vector map into the visitor's own region. | One upload plays the whole scene |
| 5.9 | Sonnet | Full Ask scene: Translator, Scout with the Archivist pointing, Judge, Storyteller pinning badges, Fact-Checker when enabled, and the "nothing found" scene. The Translator highlights the question's words by influence, the Scout's lantern lights candidates on the vector map (meaning-based and word-based finds in different colours), and the Judge's cards slide from old to new rank. | A good question and an unanswerable one both play correctly |
| 5.10 | Sonnet | Click a character to see what it did: the Chopper's chunks and overlaps, the Translator's word weights, the Scout's matches with vector and keyword scores and matched words, the Judge's rank changes, the Fact-Checker's verdicts. | Each panel shows real data from that question |
| 5.11 | Sonnet | Accessibility: a reduce-motion mode that swaps animations for a step list, alt text, keyboard access, and a text alternative for the vector map. | The site is usable with motion off and with keyboard only |
| 5.12 | Sonnet | Source side panel: clicking a `[n]` marker opens a panel beside the answer showing the whole original (text, a PDF at the cited page, or the pasted text) with the cited passage highlighted, next and previous buttons, and keyboard access. | Every kind of source opens in the panel with its passage visible |

If Rive's free plan blocks the exports you need, swap Rive for Lottie (the LottieFiles plugin in Figma and `@lottiefiles/dotlottie-react`). Only steps 5.5 to 5.7 change.

## Phase 6: Launch

A site where strangers upload files and ask questions needs guard rails. After this phase, the site is safe to share.

| Step | Who | Do | You check |
| --- | --- | --- | --- |
| 6.1 | Sonnet | Limits: a 20,000-character limit on pasted text, a cap on the private chunks sent with one question, a per-IP daily quota for pastes and for questions (20 a day), and a question length cap. Counts live in a `usage` table (new migration); the IP comes from `X-Forwarded-For`. | Each limit returns a clear error on the page; the 21st question in a day is politely refused |
| 6.2 | Sonnet | Auto migrations: run `python -m app.migrate` before the server in Render's start command. | A deploy with a new migration succeeds |
| 6.3 | Sonnet | Launch README: live link, a GIF of both scenes, the architecture diagram, eval scores, "Run it yourself" and "Deploy your own". | A friend can run it locally from the README alone |
| 6.4 | You | Tag release `v1.0.0` and share the link. | The release page lists the changelog |

## Milestones

- [ ] Phase 0: public repo, step skills and protections in place
- [ ] Phase 1: both empty pages live, CI green on every PR
- [ ] Phase 2: the starter library is live and anyone can paste a private text on the live site
- [ ] Phase 3: cited answers on the live site, with a baseline eval score
- [ ] Phase 4: hybrid search, Judge and Dependabot shipped (Fact-Checker, LLM-judged evals, evals in CI and tracing skipped)
- [ ] Phase 5: all eight characters animating both pages
- [ ] Phase 6: limits and README done; v1.0.0 released

## Sources

- [Claude API pricing](https://benchlm.ai/anthropic/api-pricing) (Haiku 4.5 rates)
- [Voyage AI pricing](https://docs.voyageai.com/docs/pricing) (embedding and reranker free tokens)
- [Claude Code model configuration](https://code.claude.com/docs/en/model-config) (`opusplan`)
- [Claude Code skills](https://code.claude.com/docs/en/skills) (`disable-model-invocation`)
- [Figma: set up the MCP server in Claude Code](https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server)
