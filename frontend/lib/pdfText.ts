import { MAX_PDF_BYTES, MAX_PDF_PAGES, MAX_TEXT_CHARS } from "./backend";

export type PdfErrorCode = "too-large" | "not-a-pdf" | "no-text";

/** Why a PDF could not be used; the code picks the message shown to the visitor. */
export class PdfError extends Error {
  constructor(readonly code: PdfErrorCode) {
    super(code);
    this.name = "PdfError";
  }
}

export type PdfText = {
  pages: { number: number; text: string }[];
  /** Some pages or characters were left out because of the limits. */
  truncated: boolean;
  totalPages: number;
};

function readBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Reads a PDF in the browser, page by page (nothing is sent anywhere): the first MAX_PDF_PAGES
 * pages, cut to MAX_TEXT_CHARS characters in all.
 */
export async function extractPdf(file: File): Promise<PdfText> {
  if (file.size > MAX_PDF_BYTES) throw new PdfError("too-large");
  // Loaded here so that pdf.js is never pulled into the server render.
  const { pdfjs } = await import("react-pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  let doc;
  try {
    doc = await pdfjs.getDocument({ data: await readBytes(file) }).promise;
  } catch {
    throw new PdfError("not-a-pdf");
  }

  const pages: PdfText["pages"] = [];
  let used = 0;
  let truncated = doc.numPages > MAX_PDF_PAGES;
  for (
    let number = 1;
    number <= Math.min(doc.numPages, MAX_PDF_PAGES);
    number++
  ) {
    const content = await (await doc.getPage(number)).getTextContent();
    let text = content.items
      .map((item) =>
        "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
      )
      .join("")
      .trim();
    if (!text) continue;
    const room = MAX_TEXT_CHARS - used;
    if (room <= 0) {
      truncated = true;
      break;
    }
    if (text.length > room) {
      text = text.slice(0, room);
      truncated = true;
    }
    used += text.length;
    pages.push({ number, text });
  }
  if (pages.length === 0) throw new PdfError("no-text");
  return { pages, truncated, totalPages: doc.numPages };
}
