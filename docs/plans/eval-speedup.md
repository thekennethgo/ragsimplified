# Plan: a faster, leaner eval (E1 to E3)

Owner: Kenneth Go. Written 2026-10-13. For an implementing agent (Sonnet). Runs **before** the F3/F6 eval in `docs/plans/phase-5-features.md`, on the same branch (`step-5.7h-second-look`), and ships in the F3 + F6 PR. Same rules as `phase-5-features.md` (no commits until the owner says so, local database only, never Supabase, `make lint` and `make test` before finishing).

## Why it is slow today (measured from `backend/app/eval_runner.py`)

A full `make eval` takes 12 to 15 minutes:

1. **A fixed 3-second sleep after every question** (`EVAL_DELAY`, default 3): about 5 minutes of the run is sleeping. It dates from step 3.7 (free-tier rate limits). Every client now retries 429 and 5xx with backoff (Voyage embedder, Voyage reranker, LLM client), so the sleep is no longer needed.
2. **One question at a time.** Each question waits on Voyage (embed, rerank), Mercury Decide and the LLM in turn, about 5 to 8 seconds, and nothing overlaps.
3. **The whole library is re-embedded on every run.** `prepare_database` drops the eval database and seeds the corpus plus the fixtures again: about 600 chunks through Voyage each time, although the text rarely changes.
4. **Word weights are computed for every question.** `translate_question` embeds the question plus one copy per word left out (about 10 texts instead of 1). The eval never looks at the weights.
5. **101 questions, many of them overlapping**: 15 about Apple products from the placeholder era, 9 about error codes, 9 about look-alike documents, 11 refusals.

## Decisions (do not re-decide)

- Keep measuring the real pipeline (`run_ask`, the same code as `POST /ask`), including the Storyteller's answer, for the saved baseline.
- Concurrency 2 by default (`EVAL_WORKERS`), results in question order. (Changed from 4 on 2026-10-13: at 4, 10 of 51 questions errored on the local LLM's free tier, Gemini 3.5 Flash Lite; one of them passed when re-run alone.)
- Embedding cache only in the eval runner, never in the app.
- Question set restructured around the eight "How we test it" cases (F7), 3 questions each, plus 3 more for the second look (the case being tuned), plus a coverage set. Target about 50 questions.

## Steps

### E1. Speed without changing what is measured

- `backend/app/eval_runner.py`:
  - Remove `EVAL_DELAY` and the `time.sleep` (and the `time` import if unused).
  - Run questions with `concurrent.futures.ThreadPoolExecutor(max_workers=int(os.environ.get("EVAL_WORKERS", "2")))`; collect rows in the original question order; print each `id ok/error` line as it finishes. Each question already opens its own connection through `connect`, so no shared connection.
  - New `class CachingEmbedder` (wraps an `Embedder`): a SQLite file at `evals/.cache/embeddings.sqlite` (create the folder; add `evals/.cache/` to `.gitignore`), key `sha256(model + input_type + text)`, value the vector as JSON. On `embed`, look up every text, send only the misses to the wrapped embedder in one call, store them, return vectors in input order. A lock around SQLite writes (threads). Use it for `prepare_database` and for the questions. `MODEL` and `DIMENSION` come from `app.pipeline.translator`.
  - Flags (parsed from `argv`, keep it simple, no argparse needed beyond this):
    - `--only <prefixes>`: comma-separated id prefixes (for example `--only indirect,cross`); runs just those questions. Refuses `--save-baseline` together with `--only` (a partial run must never become the baseline).
    - `--no-decider`: forces `decider=None` (the F3 "LLM-only" run without editing `.env`).
    - `--workers <n>`: overrides `EVAL_WORKERS`.
  - Errors are never silent: when a question raises, record `error_message` (`f"{type(e).__name__}: {e}"`, cut to 300 characters) in its row and print it on the question's status line (`  needle-1   error  HTTPStatusError: 429 …`). At the end, print how many errored and the distinct error types. Never print keys or headers.
  - Print the wall-clock time of the run at the end ("Ran 53 questions in 1 min 40 s").
- `backend/app/ask.py`: `run_ask(..., explain_words: bool = True)`. When `False`, the round 1 translator embeds only the question (`embedder.embed([question], input_type="query")`) and sends `words: []`. The app always uses the default; the eval runner passes `explain_words=False`. `POST /ask` does not change.
- `Makefile`: no change (`make eval ARGS="--only indirect,cross"` already works through `ARGS`).
- Tests (`backend/tests/test_eval_runner.py`, `backend/tests/test_ask.py`): `CachingEmbedder` sends only misses and returns vectors in order (fake embedder counting calls, temp cache path); `--only` filters and refuses `--save-baseline`; `--no-decider` passes `None`; rows come back in question order with 2 workers; `explain_words=False` makes one embed call with one text and sends `words: []`.

### E2. One question set built around the "How we test it" cases

- Add a `"case"` field to every question in `evals/questions.jsonl`: one of `refuse`, `injection`, `exact-code`, `needle`, `look-alike`, `two-sources`, `conflict`, `second-look`, or `coverage`. (F7's home page groups by `case`, not by id prefix: update F7's `evalCases.ts` and `eval-summary.json` bullets to use `case`.)
- Exactly 3 questions per edge case, picked from the existing ones (keep their ids, so baseline rows stay comparable), preferring the hardest (`tier: "hard"` first) and covering different documents:
  - `refuse`: 3 of `none-*`, `near-none-*`, `none-me-1`, `none-rag-1` (keep `none-me-1` and `near-none-1`, and one `none-*`).
  - `injection`: `inject-1` to `inject-3`.
  - `exact-code`: 3 of `code-*` and `exact-*`.
  - `needle`: 3 of `needle-*`.
  - `look-alike`: 3 of `near-*` and `para-*`.
  - `two-sources`: `multi-1` to `multi-3`.
  - `conflict`: `conflict-1`, `conflict-2`, and **one new question** `conflict-3` on a newly planted disagreement (owner decision, 2026-10-13: the lore had only two). Plant it in `corpus/lore/newsletter-october-2026.md`: pick one plain number that `corpus/lore/about-rag-co.md` states (for example a room's chair count) and add one sentence to the newsletter giving a different number for the same thing, in the newsletter's voice, the same way the Bean There and Meow conflicts were planted. Change nothing else in either document. The question asks for that number (`expected_files` both documents, like `conflict-1`; copy `conflict-1`'s fields). `make seed` copies the corpus to `frontend/public/corpus/`.
  - `second-look`: 6, not 3 (the case being tuned): `indirect-1` to `indirect-4` minus one, plus 3 `cross-*` (keep `indirect-2` and `cross-1`). F7 adds `indirect-5` and `cross-6`; mark them `second-look` too.
- `coverage` (about 20): `shelf-*` (one per shelf, 10), 4 of `me-*`, 3 of `proj-*`, 3 of `rag-co-*`, and the single `place-1`, `movie-1`, `game-1`, `general-1` if they are not already covered by a `shelf-*` question on the same document.
- Delete the other questions. Then delete fixture documents in `evals/corpus/` that no remaining question expects **and** that no remaining edge case needs as a distractor (look-alike and needle questions need their near-identical neighbours: keep any fixture in the same family as a kept look-alike or needle question). List what was deleted and why in the report.
- `evals/README.md` (create it if missing): one short table of the cases, what each tests, and how many questions it has; how to run a subset (`make eval ARGS="--only second-look"` works by `case` too: make `--only` match either an id prefix or a `case`).
- Tests: every question has a known `case`; each edge case has exactly 3 questions except `second-look` (at least 6); every `expected_file` exists in `corpus/` or `evals/corpus/`.

### E3. Measure and report

- Reset the local database (see the rules in `phase-5-features.md`), then run the eval twice:
  1. `make eval ARGS=--no-decider` (LLM-only second look, the F3 check),
  2. `make eval ARGS=--save-baseline` (with Mercury Decide; saves the new baseline).
- Report: wall-clock time of each run and of the cache-warm second run; the overall metrics of both runs; per case passed/total; the `second-look` rows (id, `retrieval_hit`, first 200 characters of the answer) next to the old baseline's rows for the same ids; how many questions skipped the LLM call in run 2 (count `second_look` done events with `decided_by: "decider"`; add a `decided_by` field to each row for this).
- Note for the owner: the new baseline has fewer questions, so overall percentages are not directly comparable with the old one; compare the kept ids row by row.

## Expected result

About 50 questions, no sleeping, 4 at a time, no re-embedding of unchanged text, one embed per question: a run of roughly 1.5 to 3 minutes instead of 12 to 15, and far fewer Voyage tokens. The first run after E1 still embeds everything once to fill the cache.

## Verification

```bash
make lint
```

```bash
make test
```

```bash
make eval ARGS="--only second-look"
```
