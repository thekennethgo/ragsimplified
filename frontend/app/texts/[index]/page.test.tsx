import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { PrivateTextsProvider, usePrivateTexts } from "../../../lib/PrivateTexts";
import PrivateTextPage from "./page";

const nav = vi.hoisted(() => ({ index: "0", chunk: "1" }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ index: nav.index }),
  useSearchParams: () => new URLSearchParams(`chunk=${nav.chunk}`),
}));

beforeEach(() => {
  nav.index = "0";
  nav.chunk = "1";
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

const TEXT = "Intro line.\n\nMiso the cat hates the vacuum cleaner.\n\nOutro line.";

function Seeded({ chunkText }: { chunkText: string }) {
  const { texts, add } = usePrivateTexts();
  if (texts.length === 0) {
    add({
      title: "Pet note",
      text: TEXT,
      chunks: [
        { position: 0, heading: null, text: "Intro line." },
        { position: 1, heading: null, text: chunkText },
      ],
      vectors: [[0], [0]],
    });
  }
  return <PrivateTextPage />;
}

test("highlights the cited passage inside the pasted text", () => {
  render(
    <PrivateTextsProvider>
      <Seeded chunkText="Miso the cat hates the vacuum cleaner." />
    </PrivateTextsProvider>,
  );
  expect(screen.getByRole("heading", { name: "Pet note" })).toBeInTheDocument();
  const mark = document.querySelector("mark")!;
  expect(mark).toHaveTextContent("Miso the cat hates the vacuum cleaner.");
  expect(document.querySelector("pre")).toHaveTextContent("Intro line.");
  expect(document.querySelector("pre")).toHaveTextContent("Outro line.");
});

test("falls back to showing the chunk when it cannot be located", () => {
  render(
    <PrivateTextsProvider>
      <Seeded chunkText="Rewritten chunk text that is not in the original." />
    </PrivateTextsProvider>,
  );
  expect(screen.getByRole("heading", { name: "Cited passage" })).toBeInTheDocument();
  expect(document.querySelector("mark")).toHaveTextContent("Rewritten chunk text");
});

test("a text that is no longer in memory says so", () => {
  render(
    <PrivateTextsProvider>
      <PrivateTextPage />
    </PrivateTextsProvider>,
  );
  expect(screen.getByText(/not in this browser session/)).toBeInTheDocument();
});
