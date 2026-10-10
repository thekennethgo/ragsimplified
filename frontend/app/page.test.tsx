import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import Home from "./page";

afterEach(cleanup);

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
    "How this one is built",
  ]);
  expect(screen.getByRole("img", { name: /break room/ })).toHaveAttribute(
    "src",
    "/office/break-room.svg",
  );
  expect(screen.getByText("New here? Ask me anything.")).toBeInTheDocument();
});

test("links the Air Canada story and the five build rows to the steps that show them", () => {
  render(<Home />);
  expect(screen.getByRole("link", { name: /Air Canada paid out/ })).toHaveAttribute(
    "href",
    "https://www.cbc.ca/news/canada/british-columbia/air-canada-chatbot-lawsuit-1.7116416",
  );
  const rows = within(
    screen.getByRole("heading", { name: "How this one is built" }).closest("section")!,
  ).getAllByRole("listitem");
  expect(rows).toHaveLength(5);
  expect(screen.getByRole("link", { name: "See the Scout" })).toHaveAttribute("href", "/ask");
  expect(screen.getByRole("link", { name: "See the evals" })).toHaveAttribute(
    "href",
    "https://github.com/thekennethgo/ragsimplified/tree/main/evals",
  );
  for (const link of screen.getAllByRole("link", { name: "GitHub" })) {
    expect(link).toHaveAttribute("href", "https://github.com/thekennethgo/ragsimplified");
  }
});

test("Ask the office about me opens Ask with a question about the creator", () => {
  render(<Home />);
  const link = screen.getByRole("link", { name: /Ask the office about me/ });
  const href = link.getAttribute("href")!;
  expect(href.startsWith("/ask?q=")).toBe(true);
  expect(new URLSearchParams(href.split("?")[1]).get("q")).toBe(
    "Who built ragsimplified, and what else have they worked on?",
  );
});

test("the creator strip keeps the owner's placeholders and has no FAQ", () => {
  const { container } = render(<Home />);
  expect(container.querySelectorAll("details")).toHaveLength(0);
  const strip = screen.getByRole("region", { name: "About the creator" });
  expect(within(strip).getByText("[YOUR NAME]")).toBeInTheDocument();
  expect(within(strip).getByRole("link", { name: "GitHub" })).toBeInTheDocument();
  expect(screen.queryByText("Why did you build ragsimplified?")).toBeNull();
});
