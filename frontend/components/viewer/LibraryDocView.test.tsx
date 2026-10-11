import { cleanup, render, screen } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { resetSourcesCache } from "../../lib/sources";
import LibraryDocView from "./LibraryDocView";

beforeEach(() => resetSourcesCache());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SOURCES = {
  "rag-basics/vector-database.md": {
    source: "Wikipedia",
    url: "https://en.wikipedia.org/wiki/Vector_database",
    licence: "CC BY-SA 4.0",
    note: "revision 1374243120",
  },
  "this-project/site-faq.md": { source: "Written for this project", licence: "MIT" },
};

function stub(filename: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve(
        String(url).endsWith("/corpus/sources.json")
          ? new Response(JSON.stringify(SOURCES))
          : new Response(
              JSON.stringify({
                id: 1,
                title: "A document",
                filename,
                chunks: [{ id: 1, position: 0, page: null, heading: null, text: "Body" }],
              }),
            ),
      ),
    ),
  );
}

test("shows the source as a link, the licence and the note for a Wikipedia entry", async () => {
  stub("rag-basics/vector-database.md");
  render(<LibraryDocView id={1} chunk={null} />);
  const link = await screen.findByRole("link", { name: "Wikipedia" });
  expect(link).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Vector_database");
  expect(link.closest("small")).toHaveTextContent(
    "Source: Wikipedia · CC BY-SA 4.0 · revision 1374243120",
  );
});

test("shows the source without a link when the entry has no url", async () => {
  stub("this-project/site-faq.md");
  render(<LibraryDocView id={1} chunk={null} />);
  const line = await screen.findByText(/Source: Written for this project/);
  expect(line).toHaveTextContent("Source: Written for this project · MIT");
  expect(screen.queryByRole("link", { name: "Written for this project" })).toBeNull();
});

test("shows no source line for a document without an entry", async () => {
  stub("lore/unlisted.md");
  render(<LibraryDocView id={1} chunk={null} />);
  await screen.findByRole("heading", { name: "A document" });
  expect(screen.queryByText(/Source:/)).toBeNull();
});

test("the Download link points at the original file and has the download attribute", async () => {
  stub("rag-basics/vector-database.md");
  render(<LibraryDocView id={1} chunk={null} />);
  const link = await screen.findByRole("link", { name: "Download" });
  expect(link).toHaveAttribute("href", "/corpus/rag-basics/vector-database.md");
  expect(link).toHaveAttribute("download");
});

vi.mock("react-pdf", () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({
    children,
    onLoadSuccess,
    onLoadError,
    file,
  }: {
    children: ReactNode;
    onLoadSuccess: (pdf: { numPages: number }) => void;
    onLoadError: () => void;
    file: string;
  }) => {
    useEffect(() => {
      if (file.includes("broken")) onLoadError();
      else onLoadSuccess({ numPages: 3 });
    }, [file, onLoadError, onLoadSuccess]);
    return <div data-testid="pdf">{children}</div>;
  },
  Page: ({
    pageNumber,
    customTextRenderer,
  }: {
    pageNumber: number;
    customTextRenderer?: (item: { str: string }) => string;
  }) => (
    <div
      data-testid={`page-${pageNumber}`}
      data-html={
        customTextRenderer
          ? `${customTextRenderer({ str: "Staff get 25 days of paid leave" })}|${customTextRenderer({ str: "Unrelated text" })}`
          : "none"
      }
    />
  ),
}));

function stubDoc(filename: string, chunks: object[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve(
        String(url).endsWith("/corpus/sources.json")
          ? new Response("{}")
          : new Response(JSON.stringify({ id: 1, title: "Doc", filename, chunks })),
      ),
    ),
  );
}

const MD_CHUNKS = [
  {
    id: 1,
    position: 0,
    page: null,
    heading: null,
    text: "# Doc\n\nIntro text that is long enough to overlap.\n\n## Section\n\n- item one\n\nSee [the site](https://example.com).",
  },
  {
    id: 2,
    position: 1,
    page: null,
    heading: null,
    text: "See [the site](https://example.com).\n\nSecond chunk body.",
  },
];

test("renders Markdown as elements, not as preformatted text", async () => {
  stubDoc("a/doc.md", MD_CHUNKS);
  const { container } = render(<LibraryDocView id={1} chunk={null} />);
  expect(await screen.findByRole("heading", { level: 2, name: "Section" })).toBeInTheDocument();
  expect(screen.getByRole("listitem")).toHaveTextContent("item one");
  const link = screen.getByRole("link", { name: "the site" });
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(container.querySelector("pre")).toBeNull();
});

test("the leading title heading is not rendered twice", async () => {
  stubDoc("a/doc.md", MD_CHUNKS);
  render(<LibraryDocView id={1} chunk={null} />);
  await screen.findByRole("heading", { level: 2, name: "Section" });
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
});

test("the overlapping text appears once", async () => {
  stubDoc("a/doc.md", MD_CHUNKS);
  render(<LibraryDocView id={1} chunk={null} />);
  await screen.findByText("Second chunk body.");
  expect(screen.getAllByRole("link", { name: "the site" })).toHaveLength(1);
});

test("the cited chunk is highlighted and tagged", async () => {
  stubDoc("a/doc.md", MD_CHUNKS);
  const { container } = render(<LibraryDocView id={1} chunk={1} />);
  const body = await screen.findByText("Second chunk body.");
  expect(body.closest("[aria-current='true']")).not.toBeNull();
  expect(screen.getByText("Cited")).toBeInTheDocument();
  expect(container.querySelectorAll("[aria-current='true']")).toHaveLength(1);
});

test("a PDF renders every page, marking only the cited page's matching text", async () => {
  stubDoc("lore/staff.pdf", [
    { id: 1, position: 0, page: 2, heading: null, text: "Staff get 25 days of paid leave a year." },
  ]);
  render(<LibraryDocView id={1} chunk={0} />);
  expect(await screen.findByTestId("page-1")).toHaveAttribute("data-html", "none");
  expect(await screen.findByTestId("page-3")).toBeInTheDocument();
  expect(screen.getByTestId("page-2")).toHaveAttribute(
    "data-html",
    "<mark>Staff get 25 days of paid leave</mark>|Unrelated text",
  );
  expect(screen.getByRole("link", { name: "Open the original at page 2" })).toBeInTheDocument();
});

test("a PDF with no cited chunk still renders every page", async () => {
  stubDoc("lore/staff.pdf", [
    { id: 1, position: 0, page: 2, heading: null, text: "Staff get 25 days of paid leave." },
  ]);
  render(<LibraryDocView id={1} chunk={null} />);
  expect(await screen.findByTestId("page-3")).toBeInTheDocument();
  expect(screen.getByTestId("page-1")).toHaveAttribute("data-html", "none");
  expect(screen.getByTestId("page-2")).toHaveAttribute("data-html", "none");
});

test("a PDF that fails to load falls back to the extracted text", async () => {
  stubDoc("lore/broken.pdf", [
    { id: 1, position: 0, page: 1, heading: null, text: "Fallback **text** here." },
  ]);
  render(<LibraryDocView id={1} chunk={null} />);
  expect(await screen.findByText("text")).toBeInTheDocument();
  expect(screen.queryByTestId("pdf")).toBeNull();
});
