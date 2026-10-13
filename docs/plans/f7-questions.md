# F7 questions: owner's final say

Draft by Claude, 2026-10-13. **Edit anything in this file.** When F7 starts, this file is the source of truth for every question below and overrides the examples in `phase-5-features.md` F7. Leave a cell empty to drop it. Mark a line with `?` if you want me to suggest an alternative.

## 1. Starter questions on the Ask page (2 per shelf)

The first four shelves are shown; the rest sit behind "Show all shelves". Order of the rows = order of the cards.

| # | Shelf | Question 1 | Question 2 | Note |
|---|---|---|---|---|
| 1 | About Kenneth | What projects is Kenneth most proud of? | Where has Kenneth travelled? | Q2 is new; needs your trip paragraph in `personal.md` |
| 2 | This project | Why does the Judge sometimes take a second look? | Is my pasted text stored anywhere? | Q1 is new |
| 3 | RAG basics | What is retrieval-augmented generation? | What is a vector database? | unchanged |
| 4 | How AI works | Why do language models hallucinate? | How does a transformer work? | order swapped |
| 5 | AI history | Where did the term artificial intelligence come from? | What was the AI winter? | unchanged |
| 6 | AI and society | How could AI affect jobs? | What is algorithmic bias? | unchanged |
| 7 | RAG.co lore (fictional) | What does the RAG.co staff handbook say about lunch breaks? | What is the no-guessing guarantee in the Query Desk terms? | unchanged |
| 8 | Places & interests | What is Batam known for? | What is Central Asia known for? | Q2 is new; needs `central-asia.md` |
| 9 | Movies & games | What is Ex Machina about? | What is Watch Dogs about? | unchanged |
| 10 | General | Which chess champion lost to Deep Blue? | Which mission first landed humans on the Moon? | Q2 is new |

## 2. "How we test it" cards on the home page

Each card shows: the title, one sentence on why it is hard, an example, and the passing badge for its 3 eval questions (6 for the second look).

Important: some eval questions run against **test-only documents** (`evals/corpus/`: Acme travel policy, Zephyr router manual, Apple, Android, Star Wars…). Those are not in the live library, so a "Try it" link with them would just get "I can't answer". For those cards I suggest either a live question that shows the same skill, or no "Try it" button (the card then says "Tested on a planted document in the test library").

| # | Card title | Why it's hard (one sentence) | "Try it" question on the live site | Eval questions behind the badge |
|---|---|---|---|---|
| 1 | Says when it doesn't know | The answer isn't in the library, so it must say so instead of guessing. | What is the capital of Peru? | none-1, near-none-1, none-me-1 |
| 2 | Ignores hidden instructions | A document contains a planted instruction telling the AI to misbehave. | *(no Try it: test library only)* | inject-1, inject-2, inject-3 |
| 3 | Finds exact codes | Search by meaning misses codes like "E-4417", so word search has to catch them. | *(no Try it: test library only)* | code-1, exact-2, exact-3 |
| 4 | Finds the needle | One small detail is buried in a long document. | Who composed the original score of Cyberpunk 2077? | needle-1, needle-2, needle-3 |
| 5 | Tells look-alikes apart | Several documents sound alike but describe different things. | What kind of database stores embeddings and uses approximate nearest neighbor algorithms? | para-3, near-1, near-3 |
| 6 | Combines two sources | The answer needs a fact from each of two documents. | Which came out first, Ex Machina or The Social Network? *(live substitute; the eval ones are test-only)* | multi-1, multi-2, multi-3 |
| 7 | Handles sources that disagree | Two documents give different numbers for the same thing. | How many cups an hour can the RAG.co coffee machine Bean There make? | conflict-1, conflict-2, conflict-3 |
| 8 | Follows a lead (second look) | The question only points at the answer, so a second search is needed. | What is Kenneth's hometown like? | indirect-1, indirect-2, indirect-3, cross-1, cross-2, cross-3 (+ indirect-5, cross-6 from F7) |

Questions for you:

- Cards 2 and 3: keep them without "Try it", or should F7 also add a small live demo document (for example a fictional RAG.co "printer error codes" page for card 3)? A planted injection on the live site is not recommended.
- Card 8's badge counts 6 to 8 questions while the others count 3. Fine, or show only 3 of them?

## 3. New eval questions in F7

| id | case | Question | Expected document | Expected keyword |
|---|---|---|---|---|
| indirect-5 | second-look | What is the region Kenneth travelled to known for? | places-and-interests/central-asia.md | Silk Road |
| cross-6 | second-look | Which countries make up the region Kenneth visited on his trip? | places-and-interests/central-asia.md | Turkmenistan |

## 4. Known gaps (not questions to edit, for your decision)

- `indirect-1` "What are Kenneth's favourite movies about?" expects 4 documents (personal page + 3 films) but the second look adds at most 2 places, so it cannot pass. Options: let the second look take up to 3 places when the follow-up names several things, or expect only the 3 films.
- `cross-2` "When was the university Kenneth studied at founded?" now refuses (it answered 1949 before the second look). To be investigated.
