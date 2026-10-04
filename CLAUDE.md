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
Next.js (frontend/) on Vercel, FastAPI (backend/) on Render, Supabase Postgres + pgvector + Storage, Voyage AI embeddings and reranker, Claude Haiku 4.5 via `LLM_MODEL` env var, Langfuse, Sentry, Rive for characters.

## Layout
`frontend/`, `backend/app/pipeline/` (one module per character), `evals/`, `docs/adr/`, `corpus/`.
