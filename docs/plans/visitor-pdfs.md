# Plan: visitor PDF uploads, and a pass so the site describes the real thing (V1 to V3)

Owner: Kenneth Go. Written 2026-10-13. For an implementing agent (Sonnet). Same rules as `docs/plans/phase-5-features.md` ("Rules for the implementing agent"): no commits until the owner says so, local database only, never Supabase, `make lint` and `make test` before finishing. Branch: `step-v-visitor-pdfs` from the latest `main` (after PR #59 is merged), or from `step-5.7j-meow-rug-viewer` if the owner says so.

## Decisions (do not re-decide)

- **The browser reads the PDF**, never the server. Text is extracted with pdf.js (already shipped through `react-pdf`), page by page, and sent to `POST /upload` as page texts. The server never receives or parses a PDF file.
- The PDF file stays only in the tab's memory (a module-level `Map`), never in browser storage and never on the server. After a reload, the text stays searchable (it is stored like pasted text today) but the page view falls back to the text view.
- Limits: at most `MAX_PDF_BYTES = 5 * 1024 * 1024` and the first `MAX_PDF_PAGES = 10` pages; the extracted text is cut to the existing `MAX_TEXT_CHARS = 20_000` across pages. Scanned PDFs (no text layer) are refused with a clear message; no OCR.
- The live answer model is **Google Gemini 3.5 Flash Lite** (`LLM_MODEL=gemini-3.5-flash-lite`, OpenAI-compatible client), not Claude Haiku. Texts that describe the current setup say so; ADRs keep their history and get a dated note.

## V1. PDF uploads

Backend (`backend/app/upload.py`, `backend/app/pipeline/scout.py`, `backend/app/ask.py`):

- `UploadRequest`: `text: str | None = None` (max `MAX_TEXT_CHARS`) and new `pages: list[UploadPage] | None = None` with `UploadPage(number: int >= 1, text: str)`, at most `MAX_PDF_PAGES` pages and at most `MAX_TEXT_CHARS` characters in total. Exactly one of `text` or `pages` must be set (a model validator; 422 otherwise).
- `run_upload`: `chop([Page(number=None, text=text)])` for text, `chop([Page(number=p.number, text=p.text) for p in pages])` for pages. The chopper already keeps page numbers. The translator done event's `chunks` gain `"page"`.
- `PrivateChunk` gains `page: int | None = None`; private results carry it through to `Result.page`, so the Scout list, the Judge, the Storyteller's `page="…"` attribute and the citations show the page like library PDFs. `AskRequest`'s private chunk model accepts `page` (optional).
- Tests: pages produce chunks with their page numbers; both or neither of `text`/`pages` is a 422; too many pages or characters is a 422; a private chunk's page reaches the citation.

Frontend:

- `frontend/lib/pdfText.ts` (new): `async function extractPdf(file: File): Promise<{ pages: { number: number; text: string }[]; truncated: boolean; totalPages: number }>`, using `pdfjs` from `react-pdf` (same worker setup as `PdfView`). Join each page's text items with spaces and line breaks (`hasEOL`). Stop at `MAX_PDF_PAGES` or when the total reaches `MAX_TEXT_CHARS` (cut the last page's text), setting `truncated`. Throw a typed error when the file is over `MAX_PDF_BYTES`, is not a PDF, or every page's text is empty after trimming.
- `frontend/components/upload/EnvelopeForm.tsx`:
  - Heading "Add a text" → **"Upload your own document"**; the file hint ".md or .txt" → ".pdf, .md or .txt"; the file input accepts `.pdf`.
  - Picking a PDF: extract it, fill the title from the file name (without extension) if empty, show a read-only summary instead of putting the text in the box ("<n> pages read, <chars> characters" and, when `truncated`, "Only the first <n> pages were read."), and send `{ title, pages }`. Errors in the existing error style: "This PDF is larger than 5 MB.", "This PDF has no selectable text (it may be a scan).", "This file could not be read as a PDF." Clearing the form clears the PDF.
  - Keep the PDF `File` in the in-memory store (`frontend/lib/pdfFiles.ts`: `set(id, file)`, `get(id)`, `remove(id)`), keyed by the private text's id; removing the text from the folder removes it.
- The private text's stored chunks keep `page`; the ask request sends it.
- `frontend/components/viewer/PdfView.tsx`: accept `file: string | Blob` instead of only the `/corpus/` URL (library documents keep passing the URL). Highlighting and sizing unchanged.
- `frontend/components/viewer/PrivateTextView.tsx`: when the text came from a PDF and `pdfFiles.get(id)` has the file, show `PdfView` with it (cited page, passage marked), with the text view as the fallback on load error; when the file is gone (after a reload), show the text view and one line "The PDF is no longer open in this tab, so the text is shown instead." The Download button saves the original PDF when it is in memory, else the `.txt` as today.
- Home page hero button "Add your own text" → **"Upload your own document"**.
- Tests: `extractPdf` with a mocked `pdfjs` (pages, truncation, empty text, too big); the envelope sends `pages` for a PDF and `text` for `.md`/`.txt`; the viewer uses `PdfView` with the in-memory file and falls back without it; the new labels.

## V2. The site describes the real thing

- Frontend texts that name the answer model use `llmName(about)` from `frontend/lib/about.ts` where `/about` is loaded, or "Google Gemini" where it is not:
  - `frontend/components/upload/EnvelopeForm.tsx` privacy note: "Sent to Voyage AI (fingerprints) and <llmName> (answers). Never stored on our server: it stays in this tab until you close it. PDFs are read in your browser."
  - `frontend/app/page.tsx` FAQ "What is it built with?": "Next.js, FastAPI, Postgres with pgvector, Voyage AI, Google Gemini 3.5 Flash Lite and Mercury Decide. Open source."
  - grep `frontend/` (not tests) for "Anthropic", "Claude", "Haiku" and fix any other current-state mention the same way.
- Library documents (`corpus/this-project/`), so asking the office gets true answers:
  - `site-faq.md`: "Which AI models does it use?" → the live answer model is Google's Gemini 3.5 Flash Lite (set with `LLM_MODEL`; the client also supports Claude); pasted text and PDFs (read in the browser, never stored) in the privacy answers; the free-tier/hosting answer stays true (check each sentence against the code and `.env.example`).
  - `how-this-office-works.md`: the "real setting" sentence names Gemini 3.5 Flash Lite; the Upload part says PDFs are read in the browser page by page and keep their page numbers.
  - `design-decisions.md`: one short section "Visitor PDFs are read in the browser" (why: no untrusted file parsing on the server, the file never leaves the tab).
  - `build-log.md`: add one dated entry (2026-10-13) summarising Phase 5's second half: second look, Mercury Decide, the faster eval (55 questions in about a minute and a half, grouped into the "How we test it" cases), the injection hardening, Meow and the rugs, visitor PDFs. Plain facts from the PRs, no new claims.
  - Every sentence about counts (documents, shelves, eval questions, cards) must match the repo; fix any that do not.
- Repo docs: `README.md` stack table and `CLAUDE.md`'s Stack line say "Gemini 3.5 Flash Lite via `LLM_MODEL` (OpenAI-compatible client; Claude also supported)". `docs/adr/003-llm-provider.md`: append "Update 2026-10-13: the live site runs `gemini-3.5-flash-lite` through the OpenAI-compatible client." Do not rewrite `docs/PROJECT_BRIEF.md` (historical brief).
- Do not rename the project (PLAN 6.2a).

## V3. Check and measure

- `make lint`, `make test`, the DB tests (before the reset), then reset the local database, `make seed`, `make eval ARGS=--save-baseline`. Report as usual (time, metrics, per case, anything that dropped).
- By hand on http://localhost:3000/upload: upload `corpus/lore/staff-handbook.pdf` as a visitor PDF, ask "How many days of paid leave do staff get?" on /ask, open the citation: the real page shows with the passage marked; reload and open it again: the text view with the one-line note.

## Verification

```bash
make lint
```

```bash
make test
```

```bash
make eval ARGS="--only second-look"
```
