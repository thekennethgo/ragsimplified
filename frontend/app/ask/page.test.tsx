import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { resetAboutCache } from "../../lib/about";
import { resetHealthCache } from "../../lib/health";
import { resetMapCache } from "../../lib/map";
import { PrivateTextsProvider, usePrivateTexts } from "../../lib/PrivateTexts";
import AskPage from "./page";

const ABOUT = {
  embedder: { provider: "Voyage AI", model: "voyage-4", dimensions: 1024 },
  reranker: { provider: "Voyage AI", model: "rerank-3-lite" },
  llm: { provider: "openai_compatible", model: "gemini-3.5-flash-lite", max_tokens: 1024 },
  chopper: { chunk_tokens: 500, overlap_tokens: 50, chars_per_token: 4, max_text_chars: 20000 },
  translator: { max_weighted_words: 40 },
  scout: { candidates: 20, rrf_k: 60, max_private_chunks: 60 },
  judge: { keep: 5, max_per_document: 2 },
  second_look: {
    enabled: true,
    decider: "inception/mercury-decide:free",
    threshold: 0.5,
    max_cards: 7,
    slots: 2,
    prompt: "STUB",
  },
  storyteller_prompt: "STUB SYSTEM PROMPT",
};

const emitted = vi.hoisted(() => [] as { name: string; data?: unknown }[]);
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
// When set, a second_look_rewrite scene never reaches its end (the rewrite is "in progress").
const mid = vi.hoisted(() => ({ rewrite: false }));
vi.mock("next/navigation", () => ({ useSearchParams: () => search.params }));
vi.mock("../../components/office/OfficeRoom", () => ({ default: () => null }));
vi.mock("../../lib/office/useFollow", () => ({
  useFollow: (_box: unknown, _id: string, on: boolean) =>
    on ? { left: 0, top: 0 } : null,
}));
vi.mock("../../lib/office/useSceneQueue", () => {
  const queue = {
    register: () => () => undefined,
    emit: (
      event: { name: string },
      hooks?: { onStart?: () => void; onEnd?: () => void },
    ) => {
      emitted.push(event);
      hooks?.onStart?.();
      if (!(mid.rewrite && event.name === "second_look_rewrite")) hooks?.onEnd?.();
    },
    clear: () => undefined,
    skipAll: () => undefined,
  };
  return { useSceneQueue: () => queue };
});

beforeEach(() => {
  resetMapCache();
  resetHealthCache();
  resetAboutCache();
  emitted.length = 0;
  mid.rewrite = false;
  search.params = new URLSearchParams();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function ndjson(lines: object[]): Response {
  return new Response(
    lines.map((line) => JSON.stringify(line)).join("\n") + "\n",
  );
}

const names = () => emitted.map((e) => e.name);

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
  {
    step: "scout",
    status: "done",
    data: {
      results: [
        {
          rank: 1,
          source: "library",
          title: "Apple Inc.",
          document_id: 1,
          position: 0,
          page: null,
          heading: "Founding",
          score: 0.0328,
          found_by: "both",
        },
        {
          rank: 2,
          source: "library",
          title: "iPhone",
          page: null,
          heading: null,
          score: 0.0164,
          found_by: "vector",
        },
        {
          rank: 3,
          source: "library",
          title: "Microsoft",
          page: 4,
          heading: null,
          score: 0.0161,
          found_by: "keyword",
        },
      ],
    },
  },
  { step: "judge", status: "start" },
  {
    step: "judge",
    status: "done",
    data: {
      results: [
        {
          n: 1,
          kept: true,
          old_rank: 2,
          new_rank: 1,
          rerank_score: 0.9,
          source: "library",
          title: "Apple Inc.",
          page: null,
          heading: "Founding",
        },
        {
          n: null,
          kept: false,
          old_rank: 1,
          new_rank: 2,
          rerank_score: 0.2,
          source: "library",
          title: "iPhone",
          page: null,
          heading: null,
        },
        {
          n: null,
          kept: false,
          old_rank: 3,
          new_rank: 3,
          rerank_score: 0.1,
          source: "library",
          title: "Microsoft",
          page: 4,
          heading: null,
        },
      ],
      fallback: false,
    },
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

/** Answers GET /library with an empty library and POST /ask with the events. */
function stubFetch(askResponse: () => Response, library: object[] = []) {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      url.endsWith("/health")
        ? new Response("{}")
        : url.endsWith("/about")
          ? new Response(JSON.stringify(ABOUT))
          : url.endsWith("/library")
            ? new Response(JSON.stringify(library))
          : url.endsWith("/map")
            ? new Response("[]")
            : askResponse(),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubAsk(events: object[] = EVENTS, library: object[] = []) {
  return stubFetch(() => ndjson(events), library);
}

/** The arguments of the POST /ask call. */
function askCall(fetchMock: ReturnType<typeof stubAsk>) {
  return fetchMock.mock.calls.find(([url]) =>
    String(url).endsWith("/ask"),
  ) as unknown as [string, RequestInit];
}

function ask(question: string) {
  fireEvent.change(screen.getByLabelText("Your question"), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

const TWO_SOURCES = EVENTS.map((e) =>
  "data" in e &&
  (e as { step: string }).step === "storyteller" &&
  (e as { data?: { citations?: unknown } }).data?.citations
    ? {
        step: "storyteller",
        status: "done",
        data: {
          answer: "Apple was founded in 1976 [1]. It sells phones [2].",
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
            {
              n: 2,
              source: "library",
              title: "iPhone",
              page: null,
              heading: null,
              snippet: "The iPhone is a line of smartphones.",
              document_id: 8,
              position: 0,
            },
          ],
        },
      }
    : e,
);

test("streams the answer and turns [n] into a button that opens a popover", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");

  const button = await screen.findByRole("button", { name: "Source 1" });
  const answer = screen.getByRole("region", { name: "Answer" });
  expect(answer).toHaveTextContent("Apple was founded in 1976 [1]. Also.");
  expect(answer).not.toHaveTextContent("[9]");

  // Nothing opens until a marker is pressed.
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(button);
  const popover = screen.getByRole("dialog", { name: "Source 1" });
  expect(
    within(popover).getByText(/partnership on April 1, 1976/),
  ).toBeInTheDocument();
  expect(within(popover).getByText("starter library")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Show sources" })).toBeNull();
});

test("only one citation popover is open at a time, and it closes again", async () => {
  stubAsk(TWO_SOURCES);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");

  fireEvent.click(await screen.findByRole("button", { name: "Source 1" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Source 2" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  const popover = screen.getByRole("dialog", { name: "Source 2" });
  expect(within(popover).getByText(/line of smartphones/)).toBeInTheDocument();

  // same marker again, Escape and a press outside all close it
  fireEvent.click(screen.getByRole("button", { name: "Source 2" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Source 1" }));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Source 1" }));
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Source 1" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});

/** Answers the library list, one library document, and POST /ask. */
function stubWithDocument(events: object[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.endsWith("/health")) return Promise.resolve(new Response("{}"));
      if (url.endsWith("/library")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([{ id: 5, title: "Cabinet doc", filename: "general/cabinet.md", chunk_count: 1 }]),
          ),
        );
      }
      if (/\/library\/\d+$/.test(url)) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 7,
              title: "Apple Inc.",
              filename: "apple.md",
              chunks: [
                {
                  id: 1,
                  position: 3,
                  page: null,
                  heading: "Founding",
                  text: "Full founding text.",
                },
              ],
            }),
          ),
        );
      }
      return Promise.resolve(ndjson(events));
    }),
  );
}

test("Open in viewer selects the File cabinet's Viewer tab and shows the document", async () => {
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  stubWithDocument(EVENTS);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  const cabinet = screen.getByRole("region", { name: "File cabinet" });
  expect(
    within(cabinet).getByRole("button", { name: "Viewer" }),
  ).toBeDisabled();
  ask("When was Apple founded?");
  fireEvent.click(await screen.findByRole("button", { name: "Source 1" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Open in viewer",
    }),
  );

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(await screen.findByText("Full founding text.")).toBeInTheDocument();
  expect(
    within(cabinet).getByRole("button", { name: "Viewer" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(scroll).toHaveBeenCalled();
  // the Answer panel has no Viewer tab of its own
  expect(screen.getAllByRole("button", { name: "Viewer" })).toHaveLength(1);
});

test("on the Ask page a cabinet title opens the viewer instead of a page", async () => {
  Element.prototype.scrollIntoView = vi.fn();
  stubWithDocument(EVENTS);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  fireEvent.click(screen.getByRole("button", { name: "Documents" }));
  const title = await screen.findByRole("button", { name: "Cabinet doc" });
  expect(screen.queryByRole("link", { name: "Cabinet doc" })).toBeNull();
  fireEvent.click(title);
  expect(await screen.findByText("Full founding text.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Viewer" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("sends the question, with no private chunks when none were pasted", async () => {
  const fetchMock = stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });

  const [url, init] = askCall(fetchMock);
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
  await waitFor(() => expect(askCall(fetchMock)).toBeDefined());

  const [, init] = askCall(fetchMock);
  expect(JSON.parse(String(init.body)).private_chunks).toEqual([
    {
      title: "My note",
      position: 0,
      heading: null,
      text: "hello",
      vector: [0.1, 0.2],
    },
  ]);
});

test("a PDF text's chunks are sent with their page numbers", async () => {
  const fetchMock = stubAsk();
  function Seed() {
    const { add } = usePrivateTexts();
    return (
      <button
        onClick={() =>
          add({
            id: "p1",
            pdf: true,
            title: "Handbook",
            text: "hello",
            chunks: [{ position: 0, heading: null, page: 3, text: "hello" }],
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
  await waitFor(() => expect(askCall(fetchMock)).toBeDefined());
  const [, init] = askCall(fetchMock);
  expect(JSON.parse(String(init.body)).private_chunks[0].page).toBe(3);
});

test("a refusal shows no sources", async () => {
  stubAsk([
    { step: "storyteller", status: "start" },
    {
      step: "answer",
      delta: "I can't answer that from the available documents.",
    },
    {
      step: "storyteller",
      status: "done",
      data: {
        answer: "I can't answer that from the available documents.",
        citations: [],
      },
    },
  ]);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("Capital of Peru?");
  expect(await screen.findByText("Nothing was cited.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Source \d/ })).toBeNull();
});

test("an error event is shown as an alert", async () => {
  stubAsk([{ step: "error", status: "done", data: { message: "Ask failed" } }]);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("Hi?");
  expect(await screen.findByRole("alert")).toHaveTextContent("Ask failed");
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
  await screen.findByRole("button", { name: "Source 1" });
  fireEvent.click(screen.getByRole("button", { name: "Translator" }));
  const words = await screen.findByLabelText("Question words by influence");
  const apple = within(words).getByText("Apple");
  expect(apple).toHaveAttribute("data-influence", "1");
  expect(apple).toHaveAttribute("title", "Influence 1.00");
  expect(within(words).getByText("When")).toHaveAttribute(
    "data-influence",
    "0.2",
  );
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
      data: {
        words: [{ text: "<img src=x onerror=alert(1)>", influence: 0.5 }],
      },
    },
  ]);
  const { container } = render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("anything");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Translator" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Translator" }));
  expect(
    (await screen.findAllByText("<img src=x onerror=alert(1)>")).length,
  ).toBeGreaterThan(0);
  expect(container.querySelector("img")).toBeNull();
});

test("each step tab shows its status and what the step found", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  // every tab is open from the start
  expect(screen.getByRole("button", { name: "Scout" })).toBeEnabled();
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });
  for (const name of ["Translator", "Scout", "Judge"]) {
    const tab = screen.getByRole("button", { name });
    expect(tab).toBeEnabled();
    expect(within(tab).getByTitle("done")).toBeInTheDocument();
  }

  fireEvent.click(screen.getByRole("button", { name: "Scout" }));
  expect(screen.getByText("3 cards found")).toBeInTheDocument();
  expect(screen.getByText("2 by meaning")).toBeInTheDocument();
  expect(screen.getByText("2 by matching words")).toBeInTheDocument();
  expect(screen.getByText("1 both")).toBeInTheDocument();
  expect(screen.getByText(/Apple Inc\. · Founding/)).toBeInTheDocument();
  expect(screen.queryByText(/found by/i)).toBeNull();
  expect(screen.getByTitle("Found by both")).toHaveTextContent("1");
  expect(screen.getByTitle("Found by meaning")).toHaveTextContent("2");
  expect(screen.getByTitle("Found by words")).toHaveTextContent("3");

  fireEvent.click(screen.getByRole("button", { name: "Judge" }));
  expect(screen.getByText("Kept: the best 1 of 3")).toBeInTheDocument();
  expect(screen.getByText("Set aside: 2 cards")).toBeInTheDocument();
});

test("the Scout tab shows a vector map of the candidates", async () => {
  resetMapCache();
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      url.endsWith("/health")
        ? new Response("{}")
        : url.endsWith("/library")
        ? new Response("[]")
        : url.endsWith("/map")
          ? new Response(
              JSON.stringify([
                { chunk_id: 1, document_id: 1, title: "Apple Inc.", filename: "rag-basics/apple.md", position: 0, heading: null, x: 0, y: 0 },
                { chunk_id: 2, document_id: 1, title: "Apple Inc.", filename: "rag-basics/apple.md", position: 1, heading: null, x: 1, y: 1 },
              ]),
            )
          : ndjson(EVENTS),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });
  fireEvent.click(screen.getByRole("button", { name: "Scout" }));
  expect(await screen.findByRole("img", { name: /^Vector map/ })).toBeInTheDocument();
});

test("hovering a Scout row thickens that candidate's ring on the map", async () => {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      url.endsWith("/health")
        ? new Response("{}")
        : url.endsWith("/library")
        ? new Response("[]")
        : url.endsWith("/map")
          ? new Response(
              JSON.stringify([
                { chunk_id: 1, document_id: 1, title: "Apple Inc.", filename: "rag-basics/apple.md", position: 0, heading: null, x: 0, y: 0 },
                { chunk_id: 2, document_id: 1, title: "Apple Inc.", filename: "rag-basics/apple.md", position: 1, heading: null, x: 1, y: 1 },
              ]),
            )
          : ndjson(EVENTS),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });
  fireEvent.click(screen.getByRole("button", { name: "Scout" }));
  await screen.findByRole("img", { name: /^Vector map/ });
  const width = () =>
    Number(
      screen
        .getAllByTestId("candidate-ring")[0]
        .querySelector("circle")!
        .getAttribute("stroke-width"),
    );
  const before = width();
  fireEvent.mouseEnter(screen.getByTitle("Found by both").closest("li")!);
  expect(width()).toBeGreaterThan(before);
  fireEvent.mouseLeave(screen.getByTitle("Found by both").closest("li")!);
  expect(width()).toBe(before);
});

test("the Translator tab ranks the top words by influence", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });
  fireEvent.click(screen.getByRole("button", { name: "Translator" }));
  expect(screen.getByText(/Top 5 words/)).toBeInTheDocument();
  const items = screen.getAllByRole("listitem").filter((li) => li.textContent?.match(/^\w+\d\.\d\d$/));
  expect(items.map((li) => li.textContent)).toEqual(["Apple1.00"]);
});

test("a failed step shows the running step as an error", async () => {
  stubAsk([
    { step: "translator", status: "start" },
    { step: "error", status: "done", data: { message: "Ask failed" } },
  ]);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("Hi?");
  await screen.findByRole("alert");
  expect(
    within(screen.getByRole("button", { name: "Translator" })).getByTitle(
      "error",
    ),
  ).toBeInTheDocument();
  expect(names()).toEqual([
    "clerk_away",
    "clerk_start",
    "translator_start",
    "error",
  ]);
});

test("a good question plays the Clerk, the crew in order, then the Clerk with the answer", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });
  expect(emitted).toEqual([
    { name: "clerk_away" },
    { name: "clerk_start" },
    { name: "translator_start" },
    { name: "translator_done" },
    { name: "scout_start" },
    { name: "scout_done" },
    { name: "judge_start" },
    { name: "judge_done", data: { nothing: false } },
    { name: "storyteller_start" },
    { name: "storyteller_done" },
    { name: "clerk_done" },
    { name: "clerk_back" },
  ]);
});

test("when the Judge keeps nothing the Judge tells the Clerk and the Clerk shrugs", async () => {
  stubAsk([
    { step: "scout", status: "start" },
    { step: "scout", status: "done", data: { results: [] } },
    { step: "judge", status: "start" },
    {
      step: "judge",
      status: "done",
      data: {
        results: [
          {
            n: null,
            kept: false,
            old_rank: 1,
            new_rank: 1,
            rerank_score: 0.01,
            source: "library",
            title: "iPhone",
            page: null,
            heading: null,
          },
        ],
        fallback: false,
      },
    },
    { step: "storyteller", status: "start" },
    {
      step: "answer",
      delta: "I can't answer that from the available documents.",
    },
    {
      step: "storyteller",
      status: "done",
      data: {
        answer: "I can't answer that from the available documents.",
        citations: [],
      },
    },
  ]);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("Capital of Peru?");
  await waitFor(() => expect(names()).toContain("clerk_shrug"));
  expect(emitted).toContainEqual({
    name: "judge_done",
    data: { nothing: true },
  });
  expect(names().slice(-2)).toEqual(["clerk_done", "clerk_shrug"]);
  expect(names()).not.toContain("clerk_back");
  expect(
    screen.getByText("Sorry, nothing on file about that. Try something else?"),
  ).toBeInTheDocument();
});

test("only the working crew member has a speech bubble", async () => {
  const encoder = new TextEncoder();
  let push: (event: object) => void = () => undefined;
  let close: () => void = () => undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      push = (event) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      close = () => controller.close();
    },
  });
  stubFetch(() => new Response(body));
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  expect(screen.queryByRole("group", { name: "Translator" })).toBeNull();
  ask("When was Apple founded?");

  push({ step: "translator", status: "start" });
  const bubble = await screen.findByRole("group", { name: "Translator" });
  expect(
    within(bubble).getByText("Turning your question into numbers…"),
  ).toBeInTheDocument();
  expect(within(bubble).queryByText("Working")).toBeNull();
  expect(
    screen.getByRole("img", { name: "The Clerk is waiting for a reply" }),
  ).toBeInTheDocument();

  push({ step: "translator", status: "done", data: { words: [] } });
  push({ step: "scout", status: "start" });
  await screen.findByRole("group", { name: "Scout" });
  expect(screen.queryByRole("group", { name: "Translator" })).toBeNull();

  push({
    step: "scout",
    status: "done",
    data: {
      results: [
        {
          rank: 1,
          source: "library",
          title: "A",
          page: null,
          heading: null,
          score: 1,
          found_by: "both",
        },
        {
          rank: 2,
          source: "library",
          title: "B",
          page: null,
          heading: null,
          score: 1,
          found_by: "both",
        },
      ],
    },
  });
  push({ step: "judge", status: "start" });
  expect(
    await screen.findByText("Picking the best 5 of 2…"),
  ).toBeInTheDocument();
  close();
});

test("the question can be prefilled from the address (?q=)", () => {
  search.params = new URLSearchParams("q=Who made this?");
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  expect(screen.getByLabelText("Your question")).toHaveValue("Who made this?");
});

test("with the animations off the streamed answer is visible", async () => {
  localStorage.setItem("ragsimplified.animations", "off");
  // jsdom has no scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
  try {
    stubAsk();
    render(<AskPage />, { wrapper: PrivateTextsProvider });
    expect(
      await screen.findByRole("switch", { name: /Animations/ }),
    ).toHaveAttribute("aria-checked", "false");
    ask("When was Apple founded?");
    await screen.findByRole("button", { name: "Source 1" });
    expect(screen.getByRole("region", { name: "Answer" })).toHaveTextContent(
      "Apple was founded in 1976",
    );
  } finally {
    localStorage.removeItem("ragsimplified.animations");
  }
});

test("with the animations on the streamed answer waits for the Clerk", async () => {
  stubAsk([
    { step: "storyteller", status: "start" },
    { step: "answer", delta: "Streamed words that must wait." },
  ]);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  await waitFor(() => expect(names()).toContain("storyteller_start"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByText(/Streamed words that must wait/)).toBeNull();
});

test("each tab opens when its results arrive, and a starting step does not steal focus", async () => {
  const encoder = new TextEncoder();
  let push: (event: object) => void = () => undefined;
  let close: () => void = () => undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      push = (event) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      close = () => controller.close();
    },
  });
  stubFetch(() => new Response(body));
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");

  push({ step: "translator", status: "start" });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Translator" })).toBeEnabled(),
  );
  // working, not done yet: still on Answer
  expect(screen.getByRole("button", { name: "Answer" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  push({ step: "translator", status: "done", data: { words: [] } });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Translator" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );

  push({ step: "scout", status: "start" });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Scout" })).toBeEnabled(),
  );
  expect(screen.getByRole("button", { name: "Translator" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "Scout" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  close();
});

test("with the animations off the Answer tab stays selected throughout", async () => {
  localStorage.setItem("ragsimplified.animations", "off");
  Element.prototype.scrollIntoView = vi.fn();
  try {
    stubAsk();
    render(<AskPage />, { wrapper: PrivateTextsProvider });
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /Animations/ })).toHaveAttribute(
        "aria-checked",
        "false",
      ),
    );
    ask("When was Apple founded?");
    await screen.findByRole("button", { name: "Source 1" });
    expect(screen.getByRole("button", { name: "Answer" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Judge" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  } finally {
    localStorage.removeItem("ragsimplified.animations");
  }
});

test("the Animations switch toggles and remembers its setting", () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  const toggle = screen.getByRole("switch", { name: /Animations/ });
  expect(toggle).toHaveAttribute("aria-checked", "true");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(localStorage.getItem("ragsimplified.animations")).toBe("off");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(localStorage.getItem("ragsimplified.animations")).toBe("on");
  localStorage.removeItem("ragsimplified.animations");
});

const PARAGRAPHS = [
  { step: "storyteller", status: "start" },
  {
    step: "storyteller",
    status: "done",
    data: {
      answer: "First.\n\nSecond [1].",
      citations: [
        {
          n: 1,
          source: "library",
          title: "Apple Inc.",
          page: null,
          heading: null,
          snippet: "Snippet.",
          document_id: 7,
          position: 3,
        },
      ],
    },
  },
];

test("an answer is shown one paragraph per blank line, with [n] still a button", async () => {
  stubAsk(PARAGRAPHS);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("Hi?");
  const button = await screen.findByRole("button", { name: "Source 1" });
  const paragraphs = screen.getByRole("region", { name: "Answer" }).querySelectorAll("p");
  expect([...paragraphs].map((p) => p.textContent)).toEqual(["First.", "Second [1]."]);
  expect(button.closest("p")).toBe(paragraphs[1]);
});

test("after the answer the question box is empty and the question is echoed", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });
  expect(screen.getByLabelText("Your question")).toHaveValue("");
  expect(screen.getByText("You asked")).toBeInTheDocument();
  expect(screen.getByText("You asked").closest("p")).toHaveTextContent(
    "When was Apple founded?",
  );
});

test("after an error the question box keeps its text", async () => {
  stubAsk([{ step: "error", status: "done", data: { message: "Ask failed" } }]);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("Keep me");
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Your question")).toHaveValue("Keep me");
});

test("once a tab is clicked the panel stops switching on its own, until a new question", async () => {
  const encoder = new TextEncoder();
  const bodies: { push: (event: object) => void; close: () => void }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.endsWith("/about")) return Promise.resolve(new Response(JSON.stringify(ABOUT)));
      if (url.endsWith("/health") || url.endsWith("/library") || url.endsWith("/map")) {
        return Promise.resolve(new Response(url.endsWith("/health") ? "{}" : "[]"));
      }
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
        },
      });
      bodies.push({
        push: (event) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")),
        close: () => controller.close(),
      });
      return Promise.resolve(new Response(body));
    }),
  );
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  await waitFor(() => expect(bodies).toHaveLength(1));
  const first = bodies[0];
  const pressed = (name: string) => screen.getByRole("button", { name });

  first.push({ step: "translator", status: "start" });
  await waitFor(() =>
    expect(within(pressed("Translator")).getByTitle("working")).toBeInTheDocument(),
  );
  fireEvent.click(pressed("Translator"));

  first.push({ step: "translator", status: "done", data: { words: [] } });
  first.push({ step: "scout", status: "start" });
  first.push({ step: "scout", status: "done", data: { results: [] } });
  await waitFor(() =>
    expect(within(pressed("Scout")).getByTitle("done")).toBeInTheDocument(),
  );
  expect(pressed("Translator")).toHaveAttribute("aria-pressed", "true");
  expect(pressed("Scout")).toHaveAttribute("aria-pressed", "false");

  first.push({ step: "storyteller", status: "start" });
  first.push({
    step: "storyteller",
    status: "done",
    data: { answer: "Done.", citations: [] },
  });
  first.close();
  await waitFor(() => expect(screen.getByLabelText("Your question")).toHaveValue(""));
  expect(pressed("Translator")).toHaveAttribute("aria-pressed", "true");
  expect(pressed("Answer")).toHaveAttribute("aria-pressed", "false");

  // a new question starts following again
  ask("Again?");
  await waitFor(() => expect(bodies).toHaveLength(2));
  bodies[1].push({ step: "translator", status: "start" });
  bodies[1].push({ step: "translator", status: "done", data: { words: [] } });
  bodies[1].push({ step: "scout", status: "start" });
  bodies[1].push({ step: "scout", status: "done", data: { results: [] } });
  await waitFor(() => expect(pressed("Scout")).toHaveAttribute("aria-pressed", "true"));
  bodies[1].close();
});

test("a tab clicked the moment a step lands is not undone by the panel", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  // Click from a MutationObserver: that runs right after the commit that shows the Translator as done,
  // before React has flushed that commit's effects. A tab pick must still win over them.
  let clicked = false;
  const observer = new MutationObserver(() => {
    const translator = screen.queryByRole("button", { name: "Translator" });
    if (!clicked && translator && within(translator).queryByTitle("done")) {
      clicked = true;
      fireEvent.click(screen.getByRole("button", { name: "Clerk" }));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  ask("When was Apple founded?");
  await waitFor(() => expect(clicked).toBe(true));
  observer.disconnect();
  await waitFor(() => expect(screen.getByLabelText("Your question")).toHaveValue(""));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.getByRole("button", { name: "Clerk" })).toHaveAttribute("aria-pressed", "true");
});

test("the Top 5 leaves filler words out", async () => {
  stubAsk([
    { step: "translator", status: "start" },
    {
      step: "translator",
      status: "done",
      data: {
        words: [
          { text: "What", influence: 0.9 },
          { text: "is", influence: 0.8 },
          { text: "Apple", influence: 0.7 },
          { text: "silicon", influence: 0.95 },
        ],
      },
    },
  ]);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("What is Apple silicon");
  await waitFor(() => expect(screen.getByText(/Top 5 words/)).toBeInTheDocument());
  const items = screen.getAllByRole("listitem").filter((li) => li.textContent?.match(/^\w+\d\.\d\d$/));
  expect(items.map((li) => li.textContent)).toEqual(["silicon0.95", "Apple0.70"]);
});

test("example questions come from the shelves in the library, as cards in the shelf colours", async () => {
  const fetchMock = stubAsk(EVENTS, [
    { id: 1, title: "Personal", filename: "about-kenneth/personal.md", chunk_count: 1 },
    { id: 2, title: "Vector database", filename: "rag-basics/vector-database.md", chunk_count: 1 },
  ]);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  await screen.findByRole("button", { name: "What is Kenneth's academic background?" });
  expect(screen.getByText("Not sure what to ask? Try one of these")).toBeInTheDocument();
  const cards = screen.getAllByTestId("shelf-card");
  expect(cards).toHaveLength(2);
  expect(cards[0]).toHaveTextContent("About the creator");
  expect(cards[0]).toHaveStyle({ borderLeftColor: "#4e79a7" });
  expect(cards[1]).toHaveTextContent("RAG basics");
  expect(cards[1]).toHaveStyle({ borderLeftColor: "#e15759" });
  expect(screen.getByRole("button", { name: "What is a vector database?" })).toBeInTheDocument();
  // No documents on these shelves, so no cards for them.
  expect(screen.queryByRole("button", { name: "Why does the Judge sometimes take a second look?" })).toBeNull();
  const row = screen.getByRole("region", { name: "Suggested questions" });
  expect(row).toHaveAttribute("tabindex", "0");
  expect(screen.queryByRole("button", { name: /Show all shelves/ })).toBeNull();

  fireEvent.click(
    screen.getByRole("button", { name: "What is retrieval-augmented generation?" }),
  );
  expect(screen.getByLabelText("Your question")).toHaveValue(
    "What is retrieval-augmented generation?",
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(
    fetchMock.mock.calls.some(([url]) => String(url).endsWith("/ask")),
  ).toBe(false);
});

test("shows every shelf card in one scrolling row, with no Show all button", async () => {
  stubAsk(
    EVENTS,
    [
      "about-kenneth",
      "this-project",
      "rag-basics",
      "how-ai-works",
      "ai-history",
      "general",
    ].map((shelf, i) => ({
      id: i + 1,
      title: shelf,
      filename: `${shelf}/doc.md`,
      chunk_count: 1,
    })),
  );
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  await screen.findByRole("region", { name: "Suggested questions" });
  expect(screen.getAllByTestId("shelf-card")).toHaveLength(6);
  expect(screen.queryByRole("button", { name: /Show all shelves|Show fewer/ })).toBeNull();
});

test("shows no starter question cards while the library is empty", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  await screen.findByRole("button", { name: "Ask" });
  expect(screen.queryByTestId("shelf-card")).toBeNull();
  expect(screen.queryByText("Not sure what to ask? Try one of these")).toBeNull();
});

test("when the library is offline the Ask button is disabled and a note shows", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      String(url).endsWith("/health")
        ? Promise.reject(new Error("down"))
        : Promise.resolve(new Response("[]")),
    ),
  );
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  expect(await screen.findByRole("status")).toHaveTextContent(/library is offline/);
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Hi?" } });
  expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
});

test("a tab clicked before asking does not stop the panel following the run", async () => {
  const encoder = new TextEncoder();
  let push: (event: object) => void = () => undefined;
  let close: () => void = () => undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      push = (event) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      close = () => controller.close();
    },
  });
  stubFetch(() => new Response(body));
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  fireEvent.click(screen.getByRole("button", { name: "Answer" }));
  ask("When was Apple founded?");

  push({ step: "translator", status: "start" });
  push({ step: "translator", status: "done", data: { words: [] } });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Translator" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
  close();
});

test("the six character tabs are all enabled before asking", () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  for (const name of ["Clerk", "Translator", "Scout", "Judge", "Storyteller", "Answer"]) {
    expect(screen.getByRole("button", { name })).toBeEnabled();
  }
  fireEvent.click(screen.getByRole("button", { name: "Scout" }));
  expect(
    screen.getByText("Nothing yet. Ask a question to see what I do with it."),
  ).toBeInTheDocument();
});

test("the Storyteller tab shows the system prompt and the exact message sent", async () => {
  const prompt = "<chunks>\n<chunk n=\"1\">Apple text</chunk>\n</chunks>\n\n<question>\nWhen?\n</question>";
  stubAsk(
    EVENTS.map((e) =>
      (e as { step: string; status?: string }).step === "storyteller" &&
      (e as { status?: string }).status === "start"
        ? { ...e, data: { prompt } }
        : e,
    ),
  );
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  fireEvent.click(screen.getByRole("button", { name: "Storyteller" }));
  expect(screen.getByText("Ask a question to see the message.")).toBeInTheDocument();
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });
  fireEvent.click(screen.getByRole("button", { name: "Storyteller" }));
  expect(await screen.findByText("STUB SYSTEM PROMPT")).toBeInTheDocument();
  expect(screen.getByText("The rules we give the model")).toBeInTheDocument();
  expect(screen.getByText("The exact message sent this time")).toBeInTheDocument();
  expect(
    screen.getByText((_, node) => node?.tagName === "PRE" && node.textContent === prompt),
  ).toBeInTheDocument();
  // the live model is named from /about
  expect(screen.getByText(/Google Gemini · gemini-3\.5-flash-lite/)).toBeInTheDocument();
});

test("the Clerk tab shows the question that was asked", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });
  fireEvent.click(screen.getByRole("button", { name: "Clerk" }));
  const card = screen.getByText("You asked").closest("div") as HTMLElement;
  expect(card).toHaveTextContent("When was Apple founded?");
  expect(screen.getByText("Cards from your folder searched: none")).toBeInTheDocument();
});

const SECOND_LOOK_EVENTS = [
  ...EVENTS.slice(0, 5), // translator, scout, judge start (round 1)
  { ...EVENTS[5], data: { ...EVENTS[5].data, round: 1, second_look: true } },
  { step: "second_look", status: "start" },
  {
    step: "second_look",
    status: "done",
    data: { query: "Batam city overview", enough: 0.2, decided_by: "llm" },
  },
  { step: "translator", status: "start" },
  {
    step: "translator",
    status: "done",
    data: { round: 2, query: "Batam city overview", point: { x: 1, y: 2 } },
  },
  { step: "scout", status: "start" },
  {
    step: "scout",
    status: "done",
    data: {
      round: 2,
      query: "Batam city overview",
      skipped: 2,
      results: [
        {
          rank: 1,
          source: "library",
          title: "Batam",
          document_id: 9,
          position: 0,
          page: null,
          heading: null,
          score: 0.03,
          found_by: "both",
        },
      ],
    },
  },
  { step: "judge", status: "start" },
  {
    step: "judge",
    status: "done",
    data: {
      round: 2,
      query: "Batam city overview",
      results: [
        {
          n: 1,
          kept: true,
          old_rank: 1,
          new_rank: 1,
          rerank_score: 0.8,
          source: "library",
          document_id: 9,
          title: "Batam",
          position: 0,
          page: null,
          heading: null,
        },
      ],
      fallback: false,
      final: ["Apple Inc.", "Batam"],
      final_cards: [
        { n: 1, round: 1, source: "library", document_id: 1, title: "Apple Inc.", position: 0, page: null, heading: "Founding" },
        { n: 2, round: 2, source: "library", document_id: 9, title: "Batam", position: 0, page: null, heading: null },
      ],
    },
  },
  ...EVENTS.slice(6),
];

function streamed() {
  const encoder = new TextEncoder();
  let push: (event: object) => void = () => undefined;
  let close: () => void = () => undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      push = (event) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      close = () => controller.close();
    },
  });
  stubFetch(() => new Response(body));
  return { push: (event: object) => push(event), close: () => close() };
}

test("the second look's bubbles follow the story: the Judge checks, the Scout waits for the new fingerprint", async () => {
  const { push, close } = streamed();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("What is Kenneth's hometown like?");

  for (const e of SECOND_LOOK_EVENTS.slice(0, 6)) push(e);
  push({ step: "second_look", status: "start" });
  // The Judge is checking; the Scout has no bubble at all.
  const checking = await screen.findByRole("group", { name: "Judge" });
  expect(within(checking).getByText("Checking whether that's enough…")).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Scout" })).toBeNull();

  push({ step: "second_look", status: "done", data: { query: "Batam city overview", enough: 0.2 } });
  push({ step: "translator", status: "start" });
  // Round 2 translator start: the Translator works, still no second-look text for the Scout.
  await screen.findByRole("group", { name: "Translator" });
  expect(screen.queryByText(/Taking a second look/)).toBeNull();
  push({ step: "translator", status: "done", data: { round: 2, query: "Batam city overview" } });
  push({ step: "scout", status: "start" });
  expect(
    await screen.findByText("Taking a second look: “Batam city overview”"),
  ).toBeInTheDocument();
  close();
});

test("a check that says enough sends the Judge's bubble back to done", async () => {
  const { push, close } = streamed();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("What is RAG?");
  for (const e of SECOND_LOOK_EVENTS.slice(0, 6)) push(e);
  push({ step: "second_look", status: "start" });
  await screen.findByText("Checking whether that's enough…");
  push({ step: "second_look", status: "done", data: { query: null, enough: 0.9, decided_by: "decider" } });
  await waitFor(() => expect(screen.queryByRole("group", { name: "Judge" })).toBeNull());
  close();
});

async function runSecondLook() {
  stubAsk(SECOND_LOOK_EVENTS);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("What is Kenneth's hometown like?");
  await screen.findByRole("button", { name: "Source 1" });
}

const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

test("a second look gives the Clerk, Translator, Scout and Judge a round switch, opened on round 2", async () => {
  await runSecondLook();
  expect(names()).toEqual(
    expect.arrayContaining(["judge_ruled", "second_look_rewrite", "translator_start", "judge_done"]),
  );
  // The round 2 verdict is not "nothing found": the Clerk comes back with the answer.
  expect(names()).toContain("clerk_back");
  for (const tab of ["Clerk", "Translator", "Scout", "Judge"]) {
    fireEvent.click(screen.getByRole("button", { name: tab }));
    expect(pressed("Second look")).toBe("true");
    expect(pressed("Initial")).toBe("false");
  }
  fireEvent.click(screen.getByRole("button", { name: "Storyteller" }));
  expect(screen.queryByRole("button", { name: "Initial" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Answer" }));
  expect(screen.queryByRole("button", { name: "Initial" })).toBeNull();
});

test("the Clerk's round 2 page shows the new query and who decided", async () => {
  await runSecondLook();
  fireEvent.click(screen.getByRole("button", { name: "Clerk" }));
  const board = screen.getByText("On the board").closest("div") as HTMLElement;
  expect(board).toHaveTextContent("Batam city overview");
  expect(screen.getByText("Mercury Decide: 20% sure the sources were enough")).toBeInTheDocument();
  expect(screen.getByTestId("decide-meter-fill")).toHaveStyle({ width: "20%" });
  expect(screen.getByTestId("decide-meter-tick")).toHaveStyle({ left: "50%" });
  expect(screen.getByText("needs 50%")).toBeInTheDocument();
  expect(screen.queryByText("Decided by the language model")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Initial" }));
  const asked = screen.getByText("You asked").closest("div") as HTMLElement;
  expect(asked).toHaveTextContent("What is Kenneth's hometown like?");
});

test("the Clerk says the language model decided when no probability was given", async () => {
  stubAsk(
    SECOND_LOOK_EVENTS.map((e) =>
      (e as { step: string; status?: string }).step === "second_look" &&
      (e as { status?: string }).status === "done"
        ? { ...e, data: { query: "Batam city overview", enough: null, decided_by: "llm" } }
        : e,
    ),
  );
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("What is Kenneth's hometown like?");
  await screen.findByRole("button", { name: "Source 1" });
  fireEvent.click(screen.getByRole("button", { name: "Clerk" }));
  expect(screen.getByText("Decided by the language model")).toBeInTheDocument();
  expect(screen.getByText("The language model decided.")).toBeInTheDocument();
  expect(screen.queryByTestId("decide-meter-fill")).toBeNull();
});

test("the Translator's round 2 page shows the new query and no word blocks; round 1 keeps its words", async () => {
  await runSecondLook();
  fireEvent.click(screen.getByRole("button", { name: "Translator" }));
  expect(screen.getByText("Fingerprinted the Clerk's new query: “Batam city overview”")).toBeInTheDocument();
  expect(
    screen.getByText("Word weights are only worked out for your own question (see Initial)."),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Which words mattered/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Initial" }));
  expect(screen.getByText(/Which words mattered/)).toBeInTheDocument();
});

test("the Scout's round 2 page shows the skipped chip and the new list", async () => {
  await runSecondLook();
  fireEvent.click(screen.getByRole("button", { name: "Scout" }));
  expect(screen.queryByText(/Searched for/)).toBeNull();
  expect(screen.getByText("2 already found, skipped")).toBeInTheDocument();
  expect(screen.getByText("1 cards found")).toBeInTheDocument();
  expect(screen.getByText("Batam")).toBeInTheDocument();
  expect(screen.queryByText(/Apple Inc\./)).toBeNull();
  // Round 1 is still round 1's list.
  fireEvent.click(screen.getByRole("button", { name: "Initial" }));
  expect(screen.getByText("3 cards found")).toBeInTheDocument();
  expect(screen.queryByText(/already found, skipped/)).toBeNull();
});

test("the Judge's round 1 page says a second look is coming; round 2 shows the handed-over cards", async () => {
  await runSecondLook();
  fireEvent.click(screen.getByRole("button", { name: "Judge" }));
  // Round 2 page: two blocks.
  expect(screen.getByText("New cards, ranked against “Batam city overview”")).toBeInTheDocument();
  const handed = screen.getByText("Handed to the Storyteller").parentElement as HTMLElement;
  expect(within(handed).getByText("Initial")).toBeInTheDocument();
  expect(within(handed).getByText("Second look")).toBeInTheDocument();
  expect(screen.queryByText("Made room for the second look")).toBeNull();
  // Round 1 page: the banner and the way back to round 2.
  fireEvent.click(screen.getByRole("button", { name: "Initial" }));
  expect(
    screen.getByText("Not enough to answer yet. Second look: searching for “Batam city overview”"),
  ).toBeInTheDocument();
  expect(screen.getByText("Kept: the best 1 of 3")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "See the second look" }));
  expect(pressed("Second look")).toBe("true");
});

test("a run without a second look has no round switch and the Judge says it was enough", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });
  for (const tab of ["Clerk", "Translator", "Scout", "Judge"]) {
    fireEvent.click(screen.getByRole("button", { name: tab }));
    expect(screen.queryByRole("button", { name: "Initial" })).toBeNull();
  }
  expect(screen.getByText("Enough to answer. These cards go to the Storyteller.")).toBeInTheDocument();
});

test("a check that says enough shows the Judge's banner with the decision", async () => {
  stubAsk([
    ...EVENTS.slice(0, 5),
    { ...EVENTS[5], data: { ...EVENTS[5].data, round: 1, second_look: true } },
    { step: "second_look", status: "start" },
    { step: "second_look", status: "done", data: { query: null, enough: 0.9, decided_by: "decider" } },
    ...EVENTS.slice(6),
  ]);
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("What is RAG?");
  await screen.findByRole("button", { name: "Source 1" });
  fireEvent.click(screen.getByRole("button", { name: "Judge" }));
  expect(screen.getByText("Enough to answer. These cards go to the Storyteller.")).toBeInTheDocument();
  expect(screen.getByText(/Mercury Decide judged the sources enough \(90% sure they were\)/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Initial" })).toBeNull();
});

test("a new question removes the round switch", async () => {
  let events: object[] = SECOND_LOOK_EVENTS;
  stubFetch(() => ndjson(events));
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("What is Kenneth's hometown like?");
  await screen.findByRole("button", { name: "Source 1" });
  fireEvent.click(screen.getByRole("button", { name: "Scout" }));
  expect(screen.getByRole("button", { name: "Initial" })).toBeInTheDocument();
  events = EVENTS;
  ask("Another question?");
  await waitFor(() => expect(screen.queryByRole("button", { name: "Initial" })).toBeNull());
});

test("the Judge's tab says how the second look works, from GET /about", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  fireEvent.click(screen.getByRole("button", { name: "Judge" }));
  expect(await screen.findByText(/The second look is on/)).toBeInTheDocument();
});

test("the question box has no privacy line under it", () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  expect(screen.queryByText(/Sent to Voyage AI/)).toBeNull();
});

test("while the Clerk rewrites the question the Judge and the Clerk say so", async () => {
  mid.rewrite = true;
  const encoder = new TextEncoder();
  let push: (event: object) => void = () => undefined;
  let close: () => void = () => undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      push = (event) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      close = () => controller.close();
    },
  });
  stubFetch(() => new Response(body));
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("What is Kenneth's hometown like?");
  for (const e of SECOND_LOOK_EVENTS.slice(0, 6)) push(e);
  push({ step: "second_look", status: "start" });
  push({ step: "second_look", status: "done", data: { query: "Batam city overview", enough: 0.2 } });
  expect(await screen.findByText("We need more on: “Batam city overview”")).toBeInTheDocument();
  expect(screen.getByText("Rewriting the question: “Batam city overview”")).toBeInTheDocument();
  expect(names()).toEqual(expect.arrayContaining(["judge_ruled", "second_look_rewrite"]));
  close();
});

test("the second look fills the map overlay with its star and candidates, and a new question clears it", async () => {
  let events: object[] = SECOND_LOOK_EVENTS;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith("/health")
          ? new Response("{}")
          : url.endsWith("/about")
            ? new Response(JSON.stringify(ABOUT))
            : url.endsWith("/library")
              ? new Response("[]")
              : url.endsWith("/map")
                ? new Response(
                    JSON.stringify([
                      { chunk_id: 1, document_id: 1, title: "Apple Inc.", filename: "rag-basics/apple.md", position: 0, heading: null, x: 0, y: 0 },
                      { chunk_id: 2, document_id: 9, title: "Batam", filename: "rag-basics/batam.md", position: 0, heading: null, x: 1, y: 1 },
                    ]),
                  )
                : ndjson(events),
      ),
    ),
  );
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  ask("What is Kenneth's hometown like?");
  await screen.findByRole("button", { name: "Source 1" });
  fireEvent.click(screen.getByRole("button", { name: "Scout" }));
  expect((await screen.findAllByTestId("follow-up-marker")).length).toBeGreaterThan(0);
  expect(screen.getAllByTestId("follow-up-candidate-ring").length).toBeGreaterThan(0);
  events = EVENTS;
  ask("Another question?");
  await waitFor(() => expect(screen.queryByTestId("follow-up-marker")).toBeNull());
});

const DOCS = [
  { id: 1, title: "Apple Inc.", filename: "rag-basics/apple.md", chunk_count: 22 },
  { id: 2, title: "Vector database", filename: "how-ai-works/vector-database.md", chunk_count: 9 },
];
const plaqueCount = () =>
  Array.from(document.querySelectorAll('span[aria-hidden="true"]')).filter((el) =>
    /^\d+$/.test(el.textContent ?? ""),
  );

function SeedText() {
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
      seed text
    </button>
  );
}

test("the plaque shows the library's documents plus the visitor's own texts", async () => {
  stubAsk(EVENTS, DOCS);
  render(
    <PrivateTextsProvider>
      <SeedText />
      <AskPage />
    </PrivateTextsProvider>,
  );
  await waitFor(() => expect(plaqueCount().map((el) => el.textContent)).toEqual(["2"]));
  fireEvent.click(screen.getByRole("button", { name: "seed text" }));
  await waitFor(() => expect(plaqueCount().map((el) => el.textContent)).toEqual(["3"]));
});

test("a failed /library shows no count, and a later retry shows it", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    let up = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith("/library")
            ? up
              ? new Response(JSON.stringify(DOCS))
              : new Response("bad gateway", { status: 502 })
            : url.endsWith("/about")
              ? new Response(JSON.stringify(ABOUT))
              : url.endsWith("/map")
                ? new Response("[]")
                : new Response("{}"),
        ),
      ),
    );
    render(<AskPage />, { wrapper: PrivateTextsProvider });
    await vi.advanceTimersByTimeAsync(100);
    expect(plaqueCount()).toHaveLength(0);
    up = true;
    await vi.advanceTimersByTimeAsync(5000);
    await waitFor(() => expect(plaqueCount().map((el) => el.textContent)).toEqual(["2"]));
  } finally {
    vi.useRealTimers();
  }
});
