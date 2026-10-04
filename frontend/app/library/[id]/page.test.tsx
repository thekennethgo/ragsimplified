import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import LibraryDocumentPage from "./page";

const nav = vi.hoisted(() => ({ chunk: "1" as string | null }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "7" }),
  useSearchParams: () => new URLSearchParams(nav.chunk === null ? "" : `chunk=${nav.chunk}`),
}));

const scrollIntoView = vi.fn();

beforeEach(() => {
  nav.chunk = "1";
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubDocument(filename: string) {
  const doc = {
    id: 7,
    title: "Apple Inc.",
    filename,
    chunks: [
      { id: 10, position: 0, page: 1, heading: null, text: "First chunk." },
      { id: 11, position: 1, page: 4, heading: "Founding", text: "Cited chunk." },
      { id: 12, position: 2, page: 5, heading: null, text: "Last chunk." },
    ],
  };
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(doc)))));
}

test("highlights and scrolls to the cited chunk", async () => {
  stubDocument("apple-inc.md");
  render(<LibraryDocumentPage />);
  const cited = (await screen.findByText("Cited chunk.")).closest("section")!;
  expect(cited).toHaveAttribute("aria-current", "true");
  expect(screen.getByText("First chunk.").closest("section")).toHaveAttribute(
    "aria-current",
    "false",
  );
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
});

test("links to the original file, at the cited page for a PDF", async () => {
  stubDocument("paper.pdf");
  render(<LibraryDocumentPage />);
  const link = await screen.findByRole("link", { name: /Open the original/ });
  expect(link).toHaveAttribute("href", "/corpus/paper.pdf#page=4");
  expect(link).toHaveTextContent("at page 4");
});

test("a Markdown original has no page anchor", async () => {
  stubDocument("apple-inc.md");
  render(<LibraryDocumentPage />);
  const link = await screen.findByRole("link", { name: /Open the original/ });
  expect(link).toHaveAttribute("href", "/corpus/apple-inc.md");
});

test("without a cited chunk nothing is highlighted", async () => {
  nav.chunk = null;
  stubDocument("apple-inc.md");
  render(<LibraryDocumentPage />);
  await screen.findByText("Cited chunk.");
  expect(document.querySelectorAll('[aria-current="true"]').length).toBe(0);
});

test("an unknown document shows a message", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 404 }))));
  render(<LibraryDocumentPage />);
  expect(await screen.findByText("Document not found.")).toBeInTheDocument();
});
