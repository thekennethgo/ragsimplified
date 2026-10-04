# ADR 001: Stack

Status: Accepted

## Context

ragsimplified is a public, forkable RAG web app: an Upload page and an Ask page sharing one central library. It has to keep every piece a real RAG system needs (parse, chunk, embed, vector and keyword search, rerank, cited answers, evals, tracing) and nothing else. It should run on free tiers, with Claude Haiku as the only paid service, capped by a monthly spend limit. Anyone should be able to fork it and run it with little setup.

## Decision

| Piece | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js on Vercel | Free hosting, a preview URL on every PR, and a React ecosystem that Rive supports. |
| Backend | FastAPI on Render | Python has the best RAG libraries. FastAPI streams events easily, which the character scenes need. Render has a free web service. |
| Database | Supabase Postgres with pgvector | One free database holds the chunks, the vectors and the full-text index, so vector search and keyword search share one place and one transaction. |
| Embeddings and reranker | Voyage AI (voyage-4, rerank-3-lite) | Strong retrieval quality with a free allowance, and one vendor for both embedding and reranking. |
| LLM | Claude Haiku 4.5, set by the `LLM_MODEL` env var | Cheap and fast enough for cited answers. Changing the model is a config change, not a code change. |
| Tracing | Langfuse | Free tier, built for LLM calls, and shows a span per pipeline step with inputs, outputs, time, tokens and cost. |
| Characters | Rive | State machines map directly onto pipeline step events, and the files are small. |
| Tooling | Ruff and pytest (backend), Vitest (frontend), GitHub Actions | Fast, standard tools that need little configuration. |

### Recorded decisions

- **Migrations are plain `.sql` files applied by a small script.** The files live in `backend/migrations/`, numbered in order. `backend/app/migrate.py` applies the ones not yet applied and records them, so `make migrate` brings any database (local, CI or live) to the same structure. This keeps the local, CI and Supabase databases from drifting apart as the schema changes.
- **The original upload is not kept, only its chunks.** The app never needs the original file once it has been parsed and chunked, and the citations point to chunks. This avoids file storage entirely.
- **Embedding vectors are 1024 dimensions.** voyage-4 is called with `output_dimension=1024`, and the `chunks.embedding` column is `vector(1024)`. Changing it later means a new migration and re-embedding everything.
- **Render deploys with its native Python runtime.** The build is `pip install -r requirements.txt` and the start command runs `uvicorn`. No container is needed.

## Left out on purpose

- **A Storage bucket for original files.** Because only chunks are kept (see above), there is nothing to store. Skipping it removes a service, a quota and a privacy question about hosting other people's files.
- **Docker images for the apps.** Vercel and Render both build from source. Docker is used only for the local Postgres (`docker-compose.yml`), so forkers need one container, not three.
- **Sentry.** Langfuse already traces every upload and question, and Render and Vercel provide logs. A second monitoring tool adds setup for little gain at this size.
- **An ORM or migration framework.** There are two tables, and the pgvector parts (the `vector` column, the HNSW index) are clearest in raw SQL. Plain `.sql` files plus a small script are easier to read and fork than Alembic or SQLAlchemy.
- **End-to-end browser tests.** They are slow and brittle for a small app. Unit tests, a fake embedder (so tests never call paid APIs) and the eval suite cover the pipeline instead.

## Consequences

- Chunks cannot be re-made from the originals. A change to chunking means re-uploading the documents (or re-seeding the starter corpus).
- Render's free web service sleeps when idle, so the first request after a quiet spell is slow.
- We own about 30 lines of migration script and write the SQL by hand. That is small now but would not scale to a large schema.
- Supabase, Voyage, Langfuse and Render free tiers have limits. The per-IP quotas and the library size cap (step 6.1) exist to stay inside them.
- The vector size is fixed at 1024, so switching embedding models later means re-embedding.
