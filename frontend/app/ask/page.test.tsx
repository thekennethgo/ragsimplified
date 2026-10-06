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
  {
    step: "translator",
    status: "done",
    data: {
      words: [
        { text: "When", influence: 0.2 },
        { text: "Apple", influence: 1 },
        { text: "founded?", influence: null },
      ],
    },
  },
  { step: "scout", status: "start" },
  { step: "scout", status: "done", data: { results: [{}, {}, {}] } },
  { step: "judge", status: "start" },
  {
    step: "judge",
    status: "done",
    data: { results: [{ kept: true }, { kept: false }, { kept: false }], fallback: false },
  },
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

  // The sources stay out of the way until the answer or a marker is pressed.
  expect(screen.queryByRole("complementary", { name: "Sources" })).toBeNull();
  fireEvent.click(button);
  const sources = screen.getByRole("complementary", { name: "Sources" });
  expect(within(sources).getByText(/partnership on April 1, 1976/)).toBeInTheDocument();
  const [item] = within(sources).getAllByRole("listitem");
  expect(item).toHaveTextContent("Apple Inc.");
  expect(item).toHaveAttribute("aria-current", "true");
});

test("each source links to its document at the cited chunk", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  fireEvent.click(await screen.findByRole("button", { name: "Source 1" }));
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
  fireEvent.click(await screen.findByRole("button", { name: "Show sources" }));
  expect(await screen.findByText("No sources cited.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Source \d/ })).toBeNull();
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

test("the question's words are highlighted by their influence", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  const words = await screen.findByLabelText("Question words by influence");
  const apple = within(words).getByText("Apple");
  expect(apple).toHaveAttribute("data-influence", "1");
  expect(apple).toHaveAttribute("title", "Influence 1.00");
  expect(within(words).getByText("When")).toHaveAttribute("data-influence", "0.2");
  // A word the backend did not weigh is not highlighted.
  expect(within(words).getByText("founded?")).toHaveAttribute(
    "title",
    "Not weighted (long question)",
  );
});

test("markup in a question's words is shown as text, not rendered", async () => {
  stubAsk([
    {
      step: "translator",
      status: "done",
      data: { words: [{ text: "<img src=x onerror=alert(1)>", influence: 0.5 }] },
    },
  ]);
  const { container } = render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("anything");
  expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  expect(container.querySelector("img")).toBeNull();
});

test("each character shows its state from the step events", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  const group = (name: string) => screen.getByRole("group", { name });
  expect(group("Translator")).toHaveTextContent("waiting");
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });
  for (const name of ["Translator", "Scout", "Judge", "Storyteller"]) {
    expect(group(name)).toHaveTextContent("done");
  }
  expect(group("Scout")).toHaveTextContent("3 candidates");
  expect(group("Judge")).toHaveTextContent("kept 1 of 3");
  // The Archivist has no step of its own yet: it stands by in the library.
  expect(within(group("Library")).getByRole("group", { name: "Archivist" })).toHaveTextContent(
    "standing by",
  );
  expect(within(group("Library")).getByRole("group", { name: "Scout" })).toBeInTheDocument();
});

test("a failed step shows the running character as an error", async () => {
  stubAsk([
    { step: "translator", status: "start" },
    { step: "error", status: "done", data: { message: "Ask failed" } },
  ]);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("Hi?");
  await waitFor(() =>
    expect(screen.getByRole("group", { name: "Translator" })).toHaveTextContent("error"),
  );
});

test("pressing the answer opens the sources sidebar and it can be closed", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });

  fireEvent.click(screen.getByText(/Apple was founded in 1976/));
  const sidebar = screen.getByRole("complementary", { name: "Sources" });
  expect(within(sidebar).getByText(/partnership on April 1, 1976/)).toBeInTheDocument();

  fireEvent.click(within(sidebar).getByRole("button", { name: "Close sources" }));
  expect(screen.queryByRole("complementary", { name: "Sources" })).toBeNull();
});

test("asking again closes the sidebar and clears the scene", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  fireEvent.click(await screen.findByRole("button", { name: "Show sources" }));
  expect(screen.getByRole("complementary", { name: "Sources" })).toBeInTheDocument();
  ask("Another question?");
  expect(screen.queryByRole("complementary", { name: "Sources" })).toBeNull();
  await screen.findByRole("button", { name: "Source 1" });
});
