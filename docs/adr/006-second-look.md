# ADR 006: A second look after the Judge

Status: Accepted

## Context

Some questions cannot be answered by one search. "What is Kenneth's hometown like?" is an example: the profile document names the town, Batam, but the question itself does not, so the first search finds the profile and not the document about Batam. One search cannot know a name it has not read yet. The `indirect-*` questions in the evals measure exactly this, and they are where retrieval falls short of the questions people really ask.

## Decision

After the Judge, and only when it kept at least one result, the app takes at most one second look, in two stages.

1. **Decide (System 1, free).** Inception's Mercury Decide, called as `inception/mercury-decide:free` on OpenRouter's Decisions API, answers one yes/no question, "Do the sources answer the question completely?", as a probability. At 0.5 or more (`SECOND_LOOK_THRESHOLD`), the second look ends and no language model is called.
2. **Write the query (a fast LLM, only when needed).** Otherwise the configured LLM (the Storyteller's provider, no extended thinking, at most 30 output tokens) writes one follow-up search query, or `DONE`. Mercury Decide cannot write text, so it only does stage 1.

When there is a follow-up query, the Scout searches again with it, the Judge reranks the new candidates against the follow-up query (not the original question, because the linked text rarely repeats the question's words), and the final cards are all of the first round's five followed by the second round's best two that are not already among them (up to seven cards). The second look only adds cards, it never removes one. The second round reuses the step names `scout` and `judge`, so the office replays the Scout's trip with no new art.

Stage 1 is skipped, and the LLM decides alone, when `OPENROUTER_API_KEY` is not set, when any kept result is the visitor's own pasted text (private text is never sent to a new provider), or when the Decisions call fails. `SECOND_LOOK=off` switches the whole second look off. If the LLM call fails too, the second look is skipped and the first round's results are used.

Why a System 1 decision model for stage 1: it is free, it returns a calibrated probability instead of text, and a yes/no judgement needs no reasoning. Why not a reasoning model: it would cost latency and money for a judgement that does not need either.

## Consequences

- A free Mercury Decide call on most answered questions, about 1.7 seconds at the median.
- Both the check and the query writer see the full text of up to 7 cards, about 2,500 input tokens. Only when the check is doubtful: one LLM call of about 2,500 input tokens and at most 30 output tokens, plus a second Voyage search and rerank.
- A new provider, OpenRouter and Inception, sees the question and the full text of the kept library cards. It never sees pasted text.
- The Decisions API is marked alpha and may change, so any failure falls back to the LLM deciding alone, and that to skipping the second look.
- The evals' `result_titles` are the final cards across both rounds (5, or up to 7 after a second look).
