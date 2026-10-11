# Design decisions

Kenneth Go made a handful of choices while building ragsimplified that shape what the app does and does not do. Most are written up as architecture decision records (ADRs) in the repository, and some are decisions Kenneth recorded in the project plan. This document explains each in plain words.

## Keep only the steps a real RAG system needs

The design rule from the start was to keep every piece a real RAG system needs (parsing, chunking, embedding, vector and keyword search, reranking, cited answers and evaluation) and nothing else. The project is meant to teach the pipeline, so a feature that does not show a RAG step does not belong. It runs on free tiers wherever possible, and the only paid service on the live site is the language model.

## The stack (ADR 001)

The frontend is Next.js on Vercel, the backend is FastAPI on Render, and the database is Supabase Postgres with the pgvector extension. Embeddings and reranking come from Voyage AI, and the language model is Claude Haiku 4.5, chosen by an environment variable.

The main reason for Postgres with pgvector is that one free database holds the chunks, the vectors and the full-text index, so meaning search and keyword search live in one place. Python was chosen for the backend because it has the best RAG libraries, and FastAPI streams events easily, which the animated characters need. Database changes are plain numbered `.sql` files applied by a small script, rather than an ORM, so the local, test and live databases cannot drift apart.

## Only chunks are stored, never files (ADR 001)

The server keeps the chunks and their vectors, not the original files. The app never needs the original after it has been parsed and cut, and citations point to chunks. This removes file storage, a quota and the privacy question of hosting other people's files. The cost is that changing how text is chunked means loading the starter library again.

## The library is chosen by the owner (ADR 002)

The first idea was to let any visitor upload a document into one shared library. That would make the database writable by strangers, so the site would need moderation, a delete tool and size limits. Instead, the shared library is owner-curated and read-only while the site runs. Only the owner's seed command writes to it, and it holds the owner's own documents and openly licensed or project-written ones.

## Pasted texts stay private (ADR 002)

Visitors paste text instead of uploading files, with a title and a limit of 20,000 characters. The backend cuts and embeds the text, hands the chunks and vectors back to the browser, and stores nothing. Every question then carries the visitor's chunks with it. The Scout searches the library in the database and the private chunks in memory, and merges the results.

Other options were rejected. Temporary per-session rows in the database would still write visitor content to the server, and one missed filter could leak one visitor's text to another. Re-embedding on every question is slow and spends the embedding allowance. Because the backend never parses a visitor's file, there is also no file-parsing attack surface. The honest trade-offs are that private text is lost when the page is closed, has no page numbers, and still passes through Voyage and the language model provider while a question is answered.

## A provider-agnostic language model client (ADR 003)

A single small module is the only code that calls a language model. It has two implementations, one for OpenAI-style APIs and one for the Anthropic API, chosen by the `LLM_PROVIDER` setting. During development the project used Google Gemini's free tier, with Groq as a fallback. Gemini's free tier may use submitted content to improve Google products, so it is used for development only, with public test questions, and never on the live site. The live site is expected to use Claude Haiku with a monthly spend limit set in the Anthropic Console. Tests never call a language model; they use fakes.

## Hybrid search and a Judge

The first version of the Scout compared fingerprints only. Kenneth then added keyword search and merged both lists with reciprocal rank fusion, and added the Judge, which reranks 20 candidates down to 5. Reranking is a common step in industry RAG systems, and having it as its own character makes the idea visible.

## The Fact-Checker was dropped to ship

The original plan had an eighth character, a Fact-Checker that would check each cited claim against its source with a second language model call. Kenneth skipped it for version 1, along with the evaluation steps that depended on it, evaluation runs in continuous integration, and tracing. The reason is simple: they were not needed to ship a working product, and each one added setup and cost. They are marked as skipped in the plan and can be revisited after launch. The citation check that remains is cheaper: the code removes any citation number that does not match a real source.

## Animating the offices with GSAP, not Rive (ADR 004)

The offices were first planned as Rive files, one per room. That plan was replaced after a spike. Claude, the coding assistant that helped build the project, cannot edit Rive files, so every change would have gone through Kenneth in the Rive editor. A Rive file can also only switch between scenes drawn in advance, while this project wants to draw real data, such as one card per real chunk.

Instead, each room is a flat SVG file animated in code with the GSAP library. A scene is a small piece of code that builds a timeline, a queue plays scenes one at a time in event order, and all text that carries real data stays in the page as ordinary text. GSAP is free for any use since version 3.13, and the library versions are pinned exactly.

## Honest wording and accessibility of the data

Text with real data, such as speech bubbles, word weights, scores and answers, stays in the page rather than inside the artwork, so it can be read by screen readers. Decorative shapes drawn from data are hidden from assistive technology, and the same information is available as text.

## Limits to stay inside free tiers

Version 1 plans a 20,000-character limit on pasted text, a cap on the private chunks sent with a question, a question length cap, and a daily per-visitor quota of 20 questions. The quota is planned work, not yet in place. These limits exist to stay inside the free tiers of Supabase, Voyage and Render, and to keep the language model bill under its spend limit.
