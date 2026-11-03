# RAG glossary

Plain-English meanings of the words used to explain retrieval-augmented generation (RAG), with what each one means in this app.

## Retrieval-augmented generation (RAG)

A way to make a language model answer from your documents instead of only from what it learned in training. First the system retrieves the passages most related to the question, then it gives those passages to the model and asks it to answer using only them. In this app, the office characters act out each step.

## Document

One file in the library, such as a Markdown article or a PDF. Each document has a title and belongs to a shelf.

## Chunk

A small piece of a document, like an index card cut from a long letter. Searching works on chunks rather than whole documents, so the answer can point at the exact passage. In this app a chunk is up to about 500 tokens, and neighbouring chunks share about 50 tokens so no idea is cut in half without a trace.

## Token

The unit a language model reads and writes: roughly a short word or part of a longer word. In English, one token is about 4 characters on average, which is the estimate this app uses.

## Embedding

A list of numbers that captures what a piece of text means, sometimes called a vector or a fingerprint. Texts about the same idea get similar embeddings even when they use different words. This app makes embeddings of 1,024 numbers with Voyage AI.

## Vector database

A database that stores embeddings and can quickly find the ones closest to a given embedding. This app uses Postgres with the pgvector extension.

## Semantic search

Searching by meaning: the question is embedded, and the chunks with the closest embeddings are returned. It finds "car" when you asked about "automobile".

## Full-text search

Searching by words: chunks that contain the question's words are returned and ranked. It is better than semantic search at exact names, codes and numbers.

## Hybrid retrieval

Running semantic search and full-text search together and merging the two lists, so a chunk is found whether it shares the question's meaning or its wording. This app merges them with reciprocal rank fusion.

## Reranker

A second, slower and more careful model that reads each candidate chunk next to the question and scores how well it answers it. In this app the reranker (the Judge) scores 20 candidates and keeps the best 5.

## Context window

How much text a language model can read at once, measured in tokens. RAG keeps the prompt small by sending only the few chunks that matter instead of the whole library.

## Grounding

Answering only from the retrieved passages. A grounded answer can be checked against its sources.

## Citation

A marker such as [1] at the end of a sentence that points to the chunk the sentence came from. In this app, clicking a citation opens the source passage.

## Hallucination

When a language model states something that sounds right but is not true or not supported by its sources. RAG reduces hallucination by giving the model the right passages and telling it to say so when they do not contain the answer.

## Prompt injection

Text inside a document or question that tries to give the model new instructions, such as "ignore your rules". This app treats retrieved text as information to answer from, never as instructions, and its evaluation suite tests this.

## Evaluation (evals)

A fixed set of questions with known right answers, run against the system to measure how well it retrieves and answers. A change that lowers the scores is caught before it ships.
