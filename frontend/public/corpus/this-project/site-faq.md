# Site FAQ

Answers to common questions about ragsimplified, in plain words. Where a feature is not built yet, the answer says "planned".

## What is ragsimplified?

ragsimplified is a public web app that explains retrieval-augmented generation (RAG) by acting it out. A small office of cartoon characters does each step: cutting text into chunks, turning chunks into number fingerprints, filing them, searching, picking the best passages and writing an answer. Every answer comes with clickable citations to the passages it used.

## Where does my pasted text go?

When you paste a text on the Upload page, it is sent to the backend, which cuts it into chunks and asks Voyage AI to turn each chunk into a vector of numbers. The chunks and vectors come straight back to your browser. The server does not store them.

When you ask a question, your chunks travel with it so they can be searched along with the library. The matching passages are then sent to the language model so it can write the answer. So your text does reach Voyage AI, and parts of it can reach the language model provider.

## Is it stored?

No, not on the server. Your pasted texts are kept in your browser. They are held in memory only, so they are lost when you close or reload the page. The shared library is different: it is chosen by the owner and stored in the database.

## What does it cost to run?

The site is built to run mostly on free tiers: Vercel for the frontend, Render for the backend, Supabase for the database, and a free allowance from Voyage AI. The one paid service is the language model on the live site, Claude Haiku 4.5, which costs a small amount per answer. Kenneth plans a monthly spend limit of about 10 dollars in the Anthropic Console. Running your own copy costs about the same, or nothing if you use a free model for development.

## What are the limits?

Today, a pasted text can be at most 20,000 characters, a question at most 1,000 characters, and a question can carry at most 60 of your pasted chunks. A planned limit (project step 6.1) is a daily quota of 20 questions per visitor. Because the free Render server sleeps when idle, the first request after a quiet spell can take up to a minute.

## Which AI models does it use?

There are three. Voyage AI's `voyage-4` model turns text into vectors of 1,024 numbers. Voyage AI's `rerank-3-lite` model reranks the 20 candidate passages and keeps the best 5. Claude Haiku 4.5 writes the answer on the live site. The answer model is set with the `LLM_MODEL` environment variable, and during development a free Gemini model can be used instead.

## Why does it sometimes say it cannot answer?

The answer may not be in the library or in your pasted texts. The app is built to say so instead of guessing: when the Judge finds nothing relevant, the answer is "I can't answer that from the available documents." Questions about topics the library does not cover, such as cooking recipes or football results, get this reply.

## Can it make things up?

It is designed not to. The answering model is told to use only the supplied passages and to cite every claim, and the code removes any citation number that does not match a real passage. No system is perfect, which is why each citation opens the source so you can check it. An evaluation suite of questions, including unanswerable ones and planted prompt-injection attempts, is run before changes to measure retrieval and citations.

## Can I add documents to the shared library?

Not as a visitor. The library is curated by the owner, which avoids moderation and hosting other people's files. You can paste your own texts and ask about them together with the library. If you run your own copy, you add documents by putting files in the `corpus` folder and running the seed command.

## Can I run my own copy?

Yes. The code is open source under the MIT licence. You need Python 3.12, Node 24, Docker for the local database, and API keys for Voyage AI and a language model. Copy `.env.example` to `.env`, start the database with Docker, run `make migrate` and `make seed`, then start the backend and the frontend. The README has the exact commands. A "Deploy your own" guide is planned for the launch.

## Who built it?

Kenneth Go built ragsimplified in October 2026, one small reviewed step at a time, with Claude Code as a coding assistant. The plan, the decisions and the build history are in the repository.

## Where is the code?

The code is on GitHub at https://github.com/thekennethgo/ragsimplified. The backend is in `backend/`, with one module per character in `backend/app/pipeline/`. The frontend is in `frontend/`. The architecture decisions are in `docs/adr/`, and the progress plan is `PLAN.md`.

## What does the vector map show?

It is a flat picture of the whole library, where each dot is a passage and similar passages sit close together. Your question appears on it too, and the passages the Scout found are highlighted.
