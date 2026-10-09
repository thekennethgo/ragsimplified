import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { PrivateTextsProvider, usePrivateTexts } from "../lib/PrivateTexts";
import LibraryPanel from "./LibraryPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubLibrary() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            { id: 2, title: "Vector database", chunk_count: 9 },
            { id: 1, title: "Apple Inc.", chunk_count: 22 },
          ]),
        ),
      ),
    ),
  );
}

function Seed() {
  const { add } = usePrivateTexts();
  return (
    <button
      onClick={() =>
        add({
          title: "My note",
          text: "hello world",
          chunks: [{ position: 0, heading: null, text: "hello world" }],
          vectors: [[0.1]],
        })
      }
    >
      seed
    </button>
  );
}

function renderPanel(onCount?: (n: number) => void) {
  return render(
    <PrivateTextsProvider>
      <Seed />
      <LibraryPanel onCount={onCount} />
    </PrivateTextsProvider>,
  );
}

test("lists the starter collection by title, each linking to its document", async () => {
  stubLibrary();
  const onCount = vi.fn();
  renderPanel(onCount);
  const links = await screen.findAllByRole("link");
  expect(links.map((link) => link.textContent)).toEqual(["Apple Inc.", "Vector database"]);
  expect(links[0]).toHaveAttribute("href", "/library/1");
  expect(screen.getByText("22 cards")).toBeInTheDocument();
  expect(screen.getByText("2 starter books, 0 of yours")).toBeInTheDocument();
  expect(onCount).toHaveBeenCalledWith(2);
});

test("shows the visitor's books live and removes one", async () => {
  stubLibrary();
  renderPanel();
  expect(
    await screen.findByText("Nothing of yours yet. Send a text and it shows up here."),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByText("seed"));
  const mine = screen.getByRole("link", { name: "My note" });
  expect(mine).toHaveAttribute("href", "/texts/0");
  expect(screen.getByText("1 card · 11 characters")).toBeInTheDocument();
  expect(screen.getByText("2 starter books, 1 of yours")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Remove My note" }));
  expect(screen.queryByRole("link", { name: "My note" })).toBeNull();
  expect(
    screen.getByText("Nothing of yours yet. Send a text and it shows up here."),
  ).toBeInTheDocument();
});

test("the switch shows the Vector map as coming soon and back to Documents", async () => {
  stubLibrary();
  renderPanel();
  await screen.findByRole("link", { name: "Apple Inc." });
  const group = screen.getByRole("group", { name: "File cabinet view" });
  expect(within(group).getByRole("button", { name: "Documents" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  fireEvent.click(within(group).getByRole("button", { name: "Vector map" }));
  expect(within(group).getByRole("button", { name: "Vector map" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText("Coming soon")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Apple Inc." })).toBeNull();

  fireEvent.click(within(group).getByRole("button", { name: "Documents" }));
  expect(screen.getByRole("link", { name: "Apple Inc." })).toBeInTheDocument();
});
