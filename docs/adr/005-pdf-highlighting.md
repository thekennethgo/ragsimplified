# ADR 005: Showing PDFs in full and marking the cited passage

Status: Accepted

## Context

ADR 002 left highlighting the exact passage inside a PDF out of v1: a citation to a starter PDF only linked to the original at the cited page. The viewer also showed each document as a stack of extracted-text boxes, one per chunk, which is hard to read. We want a citation to open the real document, with the cited passage visible where it sits.

## Decision

- **Every PDF in the library is shown as the real PDF**, all pages in one scrolling column, whether it was opened from a citation or from the File cabinet. It uses `react-pdf@9.2.1`, which renders pages with pdf.js and an invisible, selectable text layer.
- **The cited passage is marked on its page.** The viewer scrolls to the cited page, then to the first marked text. Text on that page is wrapped in `<mark>` when it (whitespace-normalised, lower-cased, at least 4 characters) appears in the cited chunk's text. Only the cited page is marked.
- **The extracted-text view is the fallback** when the PDF fails to load.
- **Text documents and pasted texts are rendered as Markdown** with `react-markdown@10.1.0` and `remark-gfm@4.0.1`, as one continuous document (the overlap between chunks is removed on the client), with the cited chunk highlighted. Raw HTML stays off, so a document cannot inject markup. Links open in a new tab with `rel="noopener noreferrer"`.
- **The PDF viewer is loaded only when a PDF is opened** (`next/dynamic`, `ssr: false`), and the pdf.js worker is loaded from `pdfjs-dist` through `new URL(..., import.meta.url)`.
- Versions are pinned exactly.

## Options considered and rejected

- **Link to the browser's PDF viewer at `#page=N`.** It cannot mark a passage.
- **Show only the cited page with Previous and Next buttons.** The full document is easier to read and needs no navigation.
- **Highlight in the extracted text only.** The extracted text loses the PDF's layout.
- **Allow raw HTML in Markdown (`rehype-raw`).** Not needed for the corpus and widens the attack surface.

## Consequences

- A larger bundle (pdf.js and its worker), paid only by visitors who open a PDF.
- Marking is by text match, so a repeated phrase on the cited page can be marked more than once, and text split across pdf.js text items may be missed. The cited page is always shown, so the visitor can still find the passage.
- Text documents lose the per-chunk boxes; the cited chunk is the only visible chunk boundary.
