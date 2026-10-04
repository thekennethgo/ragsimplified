import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { PrivateTextsProvider, usePrivateTexts } from "../../lib/PrivateTexts";
import AskPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function ndjson(lines: object[]): Response {
  return new Response(lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
}

const EVENTS = [
  { step: "translator", status: "start" },
  { step: "translator", status: "done" },
  { step: "scout", status: "start" },
  { step: "scout", status: "done", data: { results: [] } },
  { step: "storyteller", status: "start" },
  { step: "answer", delta: "Apple was founded in 1976 [1]. " },
  { step: "answer", delta: "Also [9]." },
  {
    step: "storyteller",
    status: "done",
    data: {
      answer: "Apple was founded in 1976 [1]. Also.",
      citations: [
        {
          n: 1,
          source: "library",
          title: "Apple Inc.",
          page: null,
          heading: "Founding",
          snippet: "Apple was founded as a partnership on April 1, 1976.",
          document_id: 7,
          position: 3,
        },
      ],
    },
  },
];

function stubAsk(events: object[] = EVENTS) {
  const fetchMock = vi.fn(() => Promise.resolve(ndjson(events)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function ask(question: string) {
  fireEvent.change(screen.getByLabelText("Question"), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

test("streams the answer, turns [n] into a button and opens its source", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");

  const button = await screen.findByRole("button", { name: "Source 1" });
  const answer = screen.getByRole("region", { name: "Answer" });
  expect(answer).toHaveTextContent("Apple was founded in 1976 [1]. Also.");
  expect(answer).not.toHaveTextContent("[9]");

  const sources = screen.getByRole("region", { name: "Sources" });
  expect(within(sources).getByText(/partnership on April 1, 1976/)).toBeInTheDocument();
  fireEvent.click(button);
  const [item] = within(sources).getAllByRole("listitem");
  expect(item).toHaveTextContent("Apple Inc.");
  expect(item).toHaveAttribute("aria-current", "true");
});

test("each source links to its document at the cited chunk", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  const link = await screen.findByRole("link", { name: "Open source 1" });
  expect(link).toHaveAttribute("href", "/library/7?chunk=3");
});

test("sends the question, with no private chunks when none were pasted", async () => {
  const fetchMock = stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });

  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toMatch(/\/ask$/);
  expect(JSON.parse(String(init.body))).toEqual({
    question: "When was Apple founded?",
    private_chunks: [],
  });
});

test("sends the visitor's private chunks with their vectors", async () => {
  const fetchMock = stubAsk();
  function Seed() {
    const { add } = usePrivateTexts();
    return (
      <button
        onClick={() =>
          add({
            title: "My note",
            text: "hello",
            chunks: [{ position: 0, heading: null, text: "hello" }],
            vectors: [[0.1, 0.2]],
          })
        }
      >
        seed
      </button>
    );
  }
  render(
    <PrivateTextsProvider>
      <Seed />
      <AskPage />
    </PrivateTextsProvider>,
  );
  fireEvent.click(screen.getByText("seed"));
  ask("Hi?");
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());

  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(String(init.body)).private_chunks).toEqual([
    { title: "My note", position: 0, heading: null, text: "hello", vector: [0.1, 0.2] },
  ]);
});

test("a refusal shows no sources", async () => {
  stubAsk([
    { step: "storyteller", status: "start" },
    { step: "answer", delta: "I can't answer that from the available documents." },
    {
      step: "storyteller",
      status: "done",
      data: { answer: "I can't answer that from the available documents.", citations: [] },
    },
  ]);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("Capital of Peru?");
  expect(await screen.findByText("No sources cited.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Source/ })).toBeNull();
});

test("an error event is shown in the progress log", async () => {
  stubAsk([{ step: "error", status: "done", data: { message: "Ask failed" } }]);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("Hi?");
  await waitFor(() =>
    expect(screen.getByRole("region", { name: "Progress" })).toHaveTextContent("Ask failed"),
  );
});

test("the button stays disabled until there is a question", () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
});
