# ADR 002: Owner-curated library and private pasted text

Status: Accepted

## Context

The first plan let any visitor upload a document into one shared library that everyone could search. That makes the database writable by strangers, so the site would need moderation, an admin delete, a library size cap and a way to handle other people's files being hosted on it. We want visitors to be able to ask questions about their own material without any of that, and without their content being written to the database for security reasons.

## Decision

- **The shared library is owner-curated and read-only at runtime.** Only the owner's `make seed` command writes to the `documents` and `chunks` tables. It holds the owner's own documents and a few openly licensed ones. The seed script is where the Collector parses PDF, Markdown and text files.
- **Visitors paste text; they do not upload files.** The Upload page has a title field and a text box with a hard limit of 20,000 characters (about 5,000 tokens, roughly 10 chunks). The backend never parses a visitor's file, so there is no file-parsing attack surface.
- **A visitor's pasted text is private.** The backend chunks and embeds it (Chopper, Translator), returns the chunks and their vectors to the browser, and stores nothing.
- **The browser keeps the private data.** It holds the original text, the chunks and the vectors in memory (optionally IndexedDB so they survive a refresh).
- **Each question carries the visitor's chunks.** At the size limit this is about 40 KB, so sending it with every question is cheap. The Scout searches the library in the database and the private chunks in memory (cosine similarity), then merges the results by score.
- **Citations open the source.** A citation to a visitor's own text highlights the exact passage in the text held in the browser. A citation to a starter document links to the original in `frontend/public/corpus/` at the cited page. Highlighting the exact passage inside a PDF is not part of v1.
- **At runtime the backend writes only the `usage` table**, which holds per-IP daily counts for the quotas. The live backend's database role can therefore be limited to reading the library tables.

## Options considered and rejected

- **File uploads of up to a few MB.** The vectors for a large file would travel back to the server with every question, and the backend would parse untrusted PDFs. A small pasted-text limit removes both problems.
- **Temporary per-session rows in Postgres with expiry.** It would still write visitor content to the database, which is what we want to avoid. Deleting when the tab closes cannot be relied on, so a time-based expiry and a cleanup job would be needed anyway. Every query would also have to filter by session, and one missed filter would leak one visitor's text to another.
- **Re-embedding the text on every question.** It needs no state anywhere, but it is slow and spends Voyage quota on every question.
- **No database at all.** With a few hundred owner chunks the library could be a committed file searched in memory. We keep the database because the per-IP quotas need storage that survives Render's sleeping free tier, and because pgvector with hybrid search is part of the industry-style pipeline this project demonstrates (see ADR 001).

## Consequences

- Visitors cannot upload PDFs or other files. They paste text, and the page says so.
- Private text has no page numbers. Citations show the snippet and highlight it in the pasted text.
- Private text is lost when the tab closes unless it is kept in IndexedDB.
- A visitor's text still reaches Voyage (to embed it) and Anthropic (when it is used to answer). The page should say so.
- Prompt injection from pasted text is still possible, so the Storyteller prompt treats chunk text as data, never as instructions.
- There are two search paths (SQL for the library, in memory for private chunks). Hybrid search (step 4.1) applies to the library only; private chunks stay vector-only.
- The Collector is no longer on the live upload path, so the Upload scene starts with the pasted text arriving and the Chopper slicing it. This matters for the Figma steps in Phase 5.
- Moderation, a report link, an admin delete endpoint and a library size cap are not needed, because visitors never add to the shared library. The owner removes or changes a starter document by editing `corpus/` and re-seeding.
