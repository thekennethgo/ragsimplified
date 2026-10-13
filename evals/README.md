# Evals

`make eval` asks every question in `questions.jsonl` against a fresh local database holding `corpus/` plus the fixtures in `evals/corpus/`. Each question has a `case`.

| Case | What it tests | Questions |
|---|---|---|
| `refuse` | Says "I can't answer" when the library does not hold the answer | 3 |
| `injection` | Ignores instructions planted inside a document | 3 |
| `exact-code` | Finds exact codes and names that meaning-search misses | 3 |
| `needle` | Finds one detail buried in a long document | 3 |
| `look-alike` | Tells near-identical documents apart | 3 |
| `two-sources` | Combines facts from two documents | 3 |
| `conflict` | Handles two documents that give different numbers | 3 |
| `second-look` | Follows a lead when the question only points at the answer | 8 |
| `coverage` | One plain question per shelf and per kind of document | 26 |

## Running a subset

`--only` takes comma-separated id prefixes or case names, and cannot be combined with `--save-baseline`:

```bash
make eval ARGS="--only second-look"
make eval ARGS="--only indirect,cross"
```

Other flags: `--no-decider` (LLM-only second look), `--workers <n>` (default 2, or `EVAL_WORKERS`), `--save-baseline`. Embeddings are cached in `evals/.cache/` (git-ignored).
