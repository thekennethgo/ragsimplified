import { cleanup, render, screen } from "@testing-library/react";
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
    "About the creator",
  ]);
  expect(screen.getByRole("img", { name: /break room/ })).toHaveAttribute(
    "src",
    "/office/break-room.svg",
  );
  expect(screen.getByText("New here? Ask me anything at the front desk.")).toBeInTheDocument();
});

test("links the Air Canada story and the seven build rows to the steps that show them", () => {
  render(<Home />);
  expect(screen.getByRole("link", { name: /Air Canada had to pay out/ })).toHaveAttribute(
    "href",
    "https://www.cbc.ca/news/canada/british-columbia/air-canada-chatbot-lawsuit-1.7116416",
  );
  expect(
    screen.getAllByRole("heading", { level: 3 }).filter((h) => h.textContent?.endsWith("?")).length,
  ).toBeGreaterThanOrEqual(7);
  expect(screen.getByRole("link", { name: "See the Chopper" })).toHaveAttribute("href", "/upload");
  expect(screen.getByRole("link", { name: "See the Scout" })).toHaveAttribute("href", "/ask");
  expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/thekennethgo/ragsimplified",
  );
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

test("the creator's questions are collapsible and the owner's placeholders stay visible", () => {
  const { container } = render(<Home />);
  const details = container.querySelectorAll("details");
  expect(details.length).toBeGreaterThan(0);
  expect(details.length).toBeLessThanOrEqual(4);
  expect(screen.getByText("[YOUR NAME]: [ONE OR TWO SENTENCES ABOUT YOU].")).toBeInTheDocument();
  expect(screen.getByText("Why did you build ragsimplified?")).toBeInTheDocument();
});
