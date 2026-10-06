# Adding documents to the library

The library is owner-curated: documents come from `corpus/` and are loaded by `make seed`. Visitors can only paste private text, which is never stored.

## Steps

1. **Put the file in `corpus/`.** Supported: `.pdf`, `.md`, `.markdown`, `.txt`.
   - For Markdown, start with a `# Title` line. It becomes the document title; without one, the filename is tidied into a title.
   - Use `##` headings. Each chunk keeps its heading, and citations show it.
   - For a Wikipedia article, keep the source URL and the CC BY-SA attribution line at the top.
2. **Add a row to the table in `corpus/README.md`** with the file name and where it came from.
3. **Load it locally:** `make seed`. It needs `VOYAGE_API_KEY` and `DATABASE_URL` in `.env`. Output is one line per file: `saved`, `skipped` (already in the library) or `empty` (no text found).
4. **Check it:** `make eval`, then add a few questions about the new document to `evals/questions.jsonl` (an `expected_file` and an `expected_keyword`). More documents make retrieval harder, so scores can move.
5. **Load it on the live site:** run `make seed` with `DATABASE_URL` pointing at Supabase. Seeding locally does not touch the live database.
6. **Commit** the file, the README row and the new questions in one PR.

## What `make seed` does

Collector reads the text (with page numbers for PDFs), Chopper cuts it into chunks, Translator embeds each chunk with Voyage, Archivist stores the chunks and vectors. The keyword index fills in automatically from the chunk text. The file is also copied to `frontend/public/corpus/` so citations can link to it.

Nothing sorts or tags documents. All chunks sit in one pool and are found by meaning or by matching words.

## Things to know

- **Re-running is safe.** Files are matched by a hash of their content, so unchanged files are skipped.
- **Editing a file adds a new document.** The changed content has a new hash, so it is saved as a second document and the old one stays. Remove the old row from the database by hand until a delete tool exists.
- **After step 4.9**, `make seed` also refits the vector map over every chunk, so re-seed after adding documents.
- **Private or sensitive text does not belong here.** `corpus/` is public in the repo.
