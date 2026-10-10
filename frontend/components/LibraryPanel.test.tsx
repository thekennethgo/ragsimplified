import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { resetMapCache } from "../lib/map";
import { PrivateTextsProvider, usePrivateTexts } from "../lib/PrivateTexts";
import LibraryPanel from "./LibraryPanel";

beforeEach(() => resetMapCache());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const MAP_POINTS = [
  { chunk_id: 1, document_id: 1, title: "Apple Inc.", position: 0, heading: "History", x: 0, y: 0 },
  { chunk_id: 2, document_id: 2, title: "Vector database", position: 0, heading: null, x: 1, y: 1 },
];

function stubLibrary() {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      new Response(
        JSON.stringify(
          url.endsWith("/map")
            ? MAP_POINTS
            : [
                { id: 2, title: "Vector database", chunk_count: 9 },
                { id: 1, title: "Apple Inc.", chunk_count: 22 },
              ],
        ),
      ),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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

const openDocuments = () => fireEvent.click(screen.getByRole("button", { name: "Documents" }));

test("lists the starter collection by title, each linking to its document", async () => {
  stubLibrary();
  const onCount = vi.fn();
  renderPanel(onCount);
  openDocuments();
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
  openDocuments();
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

test("opens on the Vector map, fetching /map on mount, and switches to Documents and back", async () => {
  const fetchMock = stubLibrary();
  renderPanel();
  const group = screen.getByRole("group", { name: "File cabinet view" });
  expect(within(group).getByRole("button", { name: "Vector map" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await screen.findByRole("img", { name: "Vector map of 2 cards" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Apple Inc." })).toBeNull();
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/map"))).toBe(true);

  fireEvent.click(within(group).getByRole("button", { name: "Documents" }));
  expect(within(group).getByRole("button", { name: "Documents" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await screen.findByRole("link", { name: "Apple Inc." })).toBeInTheDocument();
  fireEvent.click(within(group).getByRole("button", { name: "Vector map" }));
  await screen.findByRole("img", { name: "Vector map of 2 cards" });
  const mapCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/map"));
  expect(mapCalls).toHaveLength(1);
});
