import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import Home from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubSummary(body: object | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(body ? new Response(JSON.stringify(body)) : new Response("", { status: 404 })),
    ),
  );
}

test("the hero links to Ask and Upload", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "A language model that looks things up before it answers.",
  );
  expect(screen.getByRole("link", { name: "Ask a question" })).toHaveAttribute("href", "/ask");
  expect(screen.getByRole("link", { name: "Add your own text" })).toHaveAttribute(
    "href",
    "/upload",
  );
});

test("shows the sections in order, with the break room and the Clerk's bubble", () => {
  render(<Home />);
  const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
  expect(headings).toEqual([
    "What is RAG?",
    "Why not just ask the model?",
    "FAQ",
    "How we test it",
  ]);
  expect(screen.getByRole("img", { name: /break room/ })).toHaveAttribute(
    "src",
    "/office/break-room.svg",
  );
  expect(screen.getByText("New here? Ask me anything.")).toBeInTheDocument();
});

test("links the Air Canada story and the four FAQ rows to the steps that show them", () => {
  render(<Home />);
  expect(screen.getByRole("link", { name: /Air Canada paid out/ })).toHaveAttribute(
    "href",
    "https://www.cbc.ca/news/canada/british-columbia/air-canada-chatbot-lawsuit-1.7116416",
  );
  const rows = within(
    screen.getByRole("heading", { name: "FAQ" }).closest("section")!,
  ).getAllByRole("listitem");
  expect(rows).toHaveLength(4);
  expect(screen.getByRole("link", { name: "See the Scout" })).toHaveAttribute("href", "/ask");
  expect(screen.queryByText("Does the search work?")).toBeNull();
  for (const link of screen.getAllByRole("link", { name: "GitHub" })) {
    expect(link).toHaveAttribute("href", "https://github.com/thekennethgo/ragsimplified");
  }
});

test("the footer is one GitHub mark linking to the repository", () => {
  const { container } = render(<Home />);
  expect(container.querySelectorAll("details")).toHaveLength(0);
  expect(screen.queryByRole("region", { name: "About the creator" })).toBeNull();
  expect(screen.queryByText("[YOUR NAME]")).toBeNull();
  expect(screen.queryByRole("link", { name: /Ask the office about me/ })).toBeNull();
  const link = screen.getByRole("link", { name: "Source code on GitHub" });
  expect(link).toHaveAttribute("href", "https://github.com/thekennethgo/ragsimplified");
  const svg = link.querySelector("svg")!;
  expect(svg).toHaveAttribute("aria-hidden", "true");
  expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
  expect(link.textContent).toBe("");
});

test("How we test it shows 8 cards, with Try it links that encode the example", () => {
  stubSummary(null);
  render(<Home />);
  const section = screen.getByRole("heading", { name: "How we test it" }).closest("section")!;
  expect(within(section).getAllByRole("listitem")).toHaveLength(8);
  const link = within(section).getAllByRole("link", { name: "Try it" })[0];
  expect(link).toHaveAttribute("href", `/ask?q=${encodeURIComponent("What is the capital of Peru?")}`);
  // The two cases that only run on planted test documents have no Try it.
  expect(within(section).getAllByRole("link", { name: "Try it" })).toHaveLength(6);
  expect(within(section).getByRole("link", { name: "See all the evals" })).toHaveAttribute(
    "href",
    "https://github.com/thekennethgo/ragsimplified/tree/main/evals",
  );
});

test("the passing badges show with the eval summary and are hidden without it", async () => {
  stubSummary({
    date: "2026-10-13",
    model: "m",
    questions: 52,
    groups: [{ id: "refuse", passed: 3, total: 3 }],
  });
  render(<Home />);
  expect(await screen.findByText("3/3 passing")).toBeInTheDocument();
  expect(screen.getAllByText(/passing$/)).toHaveLength(1);
  expect(screen.getByText(/checked against 52 questions/)).toBeInTheDocument();
  cleanup();

  stubSummary(null);
  render(<Home />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(screen.queryByText(/passing$/)).toBeNull();
});
