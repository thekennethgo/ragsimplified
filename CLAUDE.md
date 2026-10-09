# ragsimplified

A public, forkable RAG web app: an Upload page and an Ask page sharing one central library. Background, architecture, stack and the character map live in [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md).

## Working rules (follow strictly)
- PLAN.md is the source of truth. Work only on the first unticked step.
- Do exactly what that step says. No extra features, refactors or unrelated fixes.
- If the step is unclear, conflicts with the code, or needs a decision, stop and ask. Never guess.
- Before you finish, run `make lint` and `make test` (once the Makefile exists, step 1.4).
- Finish with a report: files changed, how to verify, anything you were unsure about.
- Never tick a step, commit or push until I run /ship-step.
- Never merge a PR. I review and merge every PR myself.
- Never commit secrets. Read every key from environment variables.

## Stack
Next.js (frontend/) on Vercel, FastAPI (backend/) on Render, Supabase Postgres + pgvector (chunks only, no file storage), Voyage AI embeddings and reranker, Claude Haiku 4.5 via `LLM_MODEL` env var, Langfuse, GSAP for the office rooms (ADR 004).

## Layout
`frontend/`, `backend/app/pipeline/` (one module per character), `evals/`, `docs/adr/`, `corpus/`.

## Office animation convention
Each room is one SVG in `frontend/public/office/` (`upload-room.svg`, `ask-room.svg`, `query-room.svg`, and the static `break-room.svg`) with its characters, their carried props and every extra moving part in it, animated in code with `gsap` and `@gsap/react` (exact versions in ADR 004). Ids: moving room parts in kebab-case; each character a group named after it, drawn in an 80 by 120 box with its feet at (40, 116), with a `<p>-flip` group and every part prefixed `<p>-` (`cl`, `ch`, `tr`, `ar`, `sc`, `ju`, `st`); home spots `spot-<name>` and walk targets `spot-<name>-<place>`. Scenes live in `frontend/lib/office/scenes/<room>.ts` as a map from `<step>_<status>` to a function that builds a paused timeline (optional label `handoff`); `frontend/lib/office/sceneQueue.ts` plays them one at a time, starting the next at the `handoff` label or 1 second after the end. All text with real data stays in the DOM.
