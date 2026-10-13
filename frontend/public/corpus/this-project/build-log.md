# Build log

Kenneth Go started ragsimplified on 4 October 2026 and had the Upload page, the Ask page, hybrid search, reranking, the eval suite, the animated offices and the vector map working within about a week. This log collects the lessons from that build. It is based on the project plan, the architecture decision records and the commit history.

## Build in small steps that you review

The plan lists about 55 steps, and each one is a single cycle with Claude Code: Opus plans the step, Sonnet carries it out, and Kenneth reviews the result before the next begins. Every step has a "Do", a "Done when" and an "Out of scope" line. The commit history shows the rhythm: step 0.2 sets up the working rules, steps 1.1 to 1.8 add the skeletons, database, CI and tooling, and steps 2.1 to 2.9 add the Collector, Chopper, Translator, Archivist, the upload endpoint, the Upload page and the seed script, one small pull request each, all on 4 October.

Kenneth learned that small steps with a written "out of scope" line keep an AI assistant from wandering, and that his own review is the real quality gate. Rules enforced by tools, such as lint and tests before every finish, beat rules enforced by trust.

## Decide the big questions in writing first

Before any pipeline code, Kenneth wrote ADR 001 for the stack and ADR 002 for the library. Writing ADR 002 changed the whole design. The first plan let visitors upload files into a shared library, and the ADR showed that this needed moderation, deletion tools and size caps. The decision became an owner-curated library plus private pasted text that the server never stores.

The lesson is that a short written decision, with the options that were rejected, is cheaper than discovering the problem after the code exists. ADR 003, about the language model client, came the same way: it was written on 5 October, before the first call to a model, and let development run on a free Gemini model.

## Switch tools when a spike proves a better way

The characters were first designed on a design canvas, then planned as Figma art animated with Rive. Two problems appeared. The coding assistant cannot edit Rive files, so every change would go through Kenneth. And a Rive file can only play scenes drawn in advance, while the project wants to draw real data, like one card per real chunk.

Kenneth ran a spike: he built the whole Upload cycle in GSAP on a flat SVG, and then the Ask cycle. It worked, so on 9 October ADR 004 replaced the Rive plan, and the Figma and Rive steps were removed from the plan. Kenneth learned that a small throwaway experiment is the best way to test a risky tool choice, and that it is fine to change a plan when evidence arrives.

## Drop a feature to ship

The first plan had eight characters. The Fact-Checker was to check every cited claim with a second language model call. Kenneth dropped the character and skipped the steps that depended on it: the language-model-judged evals, evals in continuous integration, and tracing. Several animation and accessibility steps were also marked as skipped for now, to revisit after version 1.0.

The lesson: a skipped step is not a failed step. Marking it clearly in the plan, with the reason, keeps the project honest and moves it toward launch. The cheaper citation check, which removes numbers that match no source, stayed.

## Add hybrid search and the Judge, and measure them

The first Scout compared meaning only. On 6 October step 4.1 added keyword search and merged the two lists with reciprocal rank fusion, and step 4.2 added the Judge, which reranks 20 candidates down to 5. Each step had to show before and after eval scores in its pull request.

Kenneth learned that retrieval problems hide in the wording of questions: some answers use different words than the question, which is where meaning search helps, and some need an exact name, which is where keyword search helps. Combining them, then reranking, is how industry systems do it, and having the Judge as a visible character makes the idea easy to explain.

## Build the eval suite early

Step 3.7 added `make eval` and a question file before the Judge existed. The questions include ones the library cannot answer and ones aimed at a planted prompt injection hidden in a test document. Step 3.8 then added a bigger set of competing documents and harder, paraphrased questions. The first baseline, from 5 October, had 53 questions: a retrieval hit rate of 97.8 percent, and 100 percent for citation validity, correct refusals and injections resisted.

The lesson: without a score, a change that "feels better" may not be better. The eval database is dropped and rebuilt on every run, and the run refuses to start against anything but a local database, so a paid or live database cannot be wiped by mistake.

## Make the pipeline visible with step events

Steps 4.8 and 4.9 changed what the backend sends. Instead of only the final answer, every step sends events with real data: the chunk boundaries, the word influences, the candidate ranks and the Judge's scores. The animation, the character tabs and the vector map are all built from those events.

The vector map came from step 4.9 (a two-dimensional PCA of every chunk vector) and step 5.0g, which drew it with Scout highlights. Kenneth learned that when the data model is designed for display, the front-end work gets much easier, and the project can show real numbers instead of decoration.

## Plan the launch around the library

Late in the build, Kenneth saw that the placeholder library of Apple and Star Wars articles was hiding the point of the project. He replaced it with a launch library of 65 documents on 10 shelves, including his own documents, Wikipedia articles on AI, and a fictional company called RAG.co with its own handbook and terms. The plan for it was written first (the plan files are now in git history), and every file got a licence check. The lesson is that the content of a RAG system is part of the product, and openly licensed or self-written text is the only text that belongs in a public repository.

## 13 October 2026: the second half of Phase 5

Between the launch library and the launch, Phase 5 added several things, each as a reviewed pull request. The second look (ADR 006) lets the office search a second time when the first five cards do not answer the question, with Inception's Mercury Decide, a free decision model, doing the yes or no check. The eval was made faster: 55 questions run in about a minute and a half, grouped into the cases shown on the home page under "How we test it". The Storyteller was hardened against instructions planted in sources. Meow, the office cat, and the RAG.co rugs were added to the rooms, along with a taller viewer and shelf cards. The last step lets a visitor upload a PDF, which the browser reads page by page so that citations show the real page.
