import { afterEach, expect, test, vi } from "vitest";

import { MAX_PDF_BYTES } from "./backend";
import { PdfError, extractPdf } from "./pdfText";

const mocks = vi.hoisted(() => ({ pages: [] as string[][] | "broken" }));

vi.mock("react-pdf", () => ({
  pdfjs: {
    GlobalWorkerOptions: {},
    getDocument: () => ({
      promise:
        mocks.pages === "broken"
          ? Promise.reject(new Error("Invalid PDF structure"))
          : Promise.resolve({
              numPages: mocks.pages.length,
              getPage: (n: number) =>
                Promise.resolve({
                  getTextContent: () =>
                    Promise.resolve({
                      items: (mocks.pages as string[][])[n - 1].map((str) => ({
                        str,
                        hasEOL: str.endsWith("."),
                      })),
                    }),
                }),
            }),
    }),
  },
}));

afterEach(() => {
  mocks.pages = [];
});

const pdf = (size = 10) => new File([new Uint8Array(size)], "doc.pdf", { type: "application/pdf" });

test("reads each page's text, with line breaks where the PDF has them", async () => {
  mocks.pages = [["Hello", "world.", "Next line"], ["Page two."]];
  const result = await extractPdf(pdf());
  expect(result).toEqual({
    pages: [
      { number: 1, text: "Hello world.\nNext line" },
      { number: 2, text: "Page two." },
    ],
    truncated: false,
    totalPages: 2,
  });
});

test("stops at 10 pages and says so", async () => {
  mocks.pages = Array.from({ length: 12 }, (_, i) => [`Page ${i + 1} text`]);
  const result = await extractPdf(pdf());
  expect(result.pages).toHaveLength(10);
  expect(result.pages[9].number).toBe(10);
  expect(result.truncated).toBe(true);
  expect(result.totalPages).toBe(12);
});

test("cuts the text at 20,000 characters across pages", async () => {
  mocks.pages = [["a".repeat(12_000)], ["b".repeat(12_000)], ["c".repeat(100)]];
  const result = await extractPdf(pdf());
  expect(result.pages.map((p) => p.text.length)).toEqual([12_000, 8_000]);
  expect(result.truncated).toBe(true);
});

test("pages without text are skipped, and a PDF with none at all is refused", async () => {
  mocks.pages = [[" "], ["Real text"]];
  expect((await extractPdf(pdf())).pages).toEqual([{ number: 2, text: "Real text" }]);
  mocks.pages = [[" "], [""]];
  await expect(extractPdf(pdf())).rejects.toMatchObject({ code: "no-text" });
});

test("a file over 5 MB is refused before it is read", async () => {
  await expect(extractPdf(pdf(MAX_PDF_BYTES + 1))).rejects.toMatchObject({ code: "too-large" });
});

test("a file pdf.js cannot open is not a PDF", async () => {
  mocks.pages = "broken";
  const error = await extractPdf(pdf()).catch((e) => e);
  expect(error).toBeInstanceOf(PdfError);
  expect(error.code).toBe("not-a-pdf");
});
