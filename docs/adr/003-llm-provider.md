# ADR 003: Provider-agnostic LLM client, free Gemini model for development

Status: Accepted

## Context

ADR 001 chose Claude Haiku 4.5, set by the `LLM_MODEL` env var, and called it "a config change, not a code change" to swap the model. That holds only within one provider. Another provider means a different API, SDK and key. Haiku is also the project's only paid service, and during development every Storyteller, Fact-Checker and eval run costs money.

We want to build and test Phase 3 and 4 on a free model, then run the live site on Haiku (or whatever the owner chooses) without rewriting the pipeline.

Free tiers checked in October 2026 (from the providers' own docs where they publish limits, otherwise from comparison articles; re-check before relying on them):

- **Groq** (no card): 30 requests/min, 1,000/day, and on `openai/gpt-oss-120b` 8K tokens/min and 200K tokens/day. Reported as not training on prompts.
- **Google Gemini** (no card): the free tier uses submitted content to improve Google products, and human reviewers may read it (Gemini API terms). Paid tier does not. Its free-tier limits are shown only in the owner's AI Studio dashboard, not in Google's docs, and comparison articles say they were cut 50–80% in late 2025. A 503 "high demand" error was seen in testing.
- **OpenRouter** `:free` models: 20 requests/min but only 50 requests/day without a $10 top-up.
- **Cerebras**: no permanent free tier since July 2026.
- **Mistral**: the large free quota requires opting in to training on your data.
- **Ollama** (local): unlimited and private, but it cannot run on Render's free instance.

## Decision

- **Development uses Gemini's free tier with `gemini-3.5-flash-lite`** (checked working through its OpenAI-compatible endpoint, `https://generativelanguage.googleapis.com/v1beta/openai/`). `gemini-3.8-flash` is the stronger option if quality needs it. **Groq with `openai/gpt-oss-120b` is the fallback** when Gemini is unavailable or its limits are too tight; it needs no card and is reported as not training on prompts.
- **Gemini's free tier is for development only, and only with non-private text.** Google uses free-tier content to improve its products and human reviewers may read it. That is acceptable for the owner's own test questions and the public starter corpus, and it is not acceptable for visitors' pasted text, which ADR 002 promises is not kept. It must never be the provider on the live site.
- OpenRouter's free models are rejected: 50 requests a day is too few.
- **One small `backend/app/llm.py` is the only code that calls an LLM.** The Storyteller, the Fact-Checker and the LLM-judged evals all use it. It exposes one function that takes a system prompt and messages and streams text back.
- **It has two implementations, chosen by `LLM_PROVIDER`:**
  - `openai_compatible`: the OpenAI-style `/chat/completions` API over `httpx`, using `LLM_BASE_URL` and `LLM_API_KEY`. This covers Groq, OpenRouter and Ollama.
  - `anthropic`: the Anthropic Messages API, using `ANTHROPIC_API_KEY`.
- **Env vars:** `LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL` (only for `openai_compatible`), `LLM_API_KEY` (only for `openai_compatible`), and the existing `ANTHROPIC_API_KEY`. All are listed with fake values in `.env.example`.
- **Tests never call an LLM.** They use a fake client, as the fake embedder does.
- **Rate limits are handled in the client.** It retries HTTP 429 and 5xx errors (Gemini's free tier returns 503 "high demand" at times) with backoff, using the provider's `retry-after` header when present, and it never retries other 4xx errors. If retries run out, the stream ends with an error event.
- **Eval results record the provider and model that produced them.** Scores from different models are never compared against each other as if they were one baseline.
- **The live site's provider is the owner's choice at launch** and is set by env vars on Render, not in code. Haiku with a spend limit (step 2.10) remains the expected default for the live site. The spend limit is only needed once `anthropic` is used.

## Options considered and rejected

- **Stay on Claude only.** Simplest code, but every development run costs money, and it keeps the Anthropic dependency for forks that cannot pay.
- **Use Anthropic's OpenAI-compatible endpoint and a single code path.** It would drop the second implementation, but Anthropic documents that endpoint as meant for testing, not production, and some features are missing.
- **A framework such as LangChain or LiteLLM.** It is a large dependency for one function. Two small clients are easier to read and to fork.
- **Gemini free tier on the live site.** See the privacy rule above; Gemini is used for development only.

## Consequences

- **The Groq fallback is small.** At roughly 4,500 tokens per question, 200K tokens/day is about 40 questions a day for the whole site, and 8K tokens/min is about one question a minute. The Fact-Checker roughly doubles the cost per question. One 30-question eval run uses most of a day's allowance, so evals can be run about once a day on Groq.
- **Quality and safety behaviour differ by model.** Citations, refusals and resistance to planted instructions (the 3.7 evals) may score differently on `gpt-oss-120b` than on Haiku. The baseline in 3.7 and the before/after scores in Phase 4 must say which model they were measured on, and should be re-measured on the live model before launch.
- **Free tiers are not for the live public site.** Gemini's terms rule it out, and Groq's daily limit would be used up quickly.
- **Free-tier terms can change.** The numbers above must be re-checked before each decision that depends on them.
- **PLAN.md changes.** Step 3.3 (`POST /ask`) and steps 4.3 and 4.4 should call `llm.py` instead of an Anthropic SDK directly, and a small step that adds `llm.py` and the env vars is needed before 3.3. This ADR does not change PLAN.md; the owner does that.
- **Langfuse (step 4.6) cost reporting** needs per-model prices, and a free model has price zero.
