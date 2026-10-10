import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { PrivateTextsProvider, usePrivateTexts } from "../../lib/PrivateTexts";
import AskPage from "./page";

const emitted = vi.hoisted(() => [] as { name: string; data?: unknown }[]);
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
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
      hooks?.onEnd?.();
    },
    clear: () => undefined,
    skipAll: () => undefined,
  };
  return { useSceneQueue: () => queue };
});

beforeEach(() => {
  emitted.length = 0;
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
function stubFetch(askResponse: () => Response) {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      url.endsWith("/library") ? new Response("[]") : askResponse(),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubAsk(events: object[] = EVENTS) {
  return stubFetch(() => ndjson(events));
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
      if (url.endsWith("/library")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([{ id: 5, title: "Cabinet doc", chunk_count: 1 }]),
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
    await screen.findByText("<img src=x onerror=alert(1)>"),
  ).toBeInTheDocument();
  expect(container.querySelector("img")).toBeNull();
});

test("each step tab shows its status and what the step found", async () => {
  stubAsk();
  render(<AskPage />, { wrapper: PrivateTextsProvider });
  // the step tabs wait until their step has data
  expect(screen.getByRole("button", { name: "Scout" })).toBeDisabled();
  ask("When was Apple founded?");
  await screen.findByRole("button", { name: "Source 1" });
  for (const name of ["Translator", "Scout", "Judge", "Storyteller"]) {
    const tab = screen.getByRole("button", { name });
    expect(tab).toBeEnabled();
    expect(within(tab).getByTitle("done")).toBeInTheDocument();
  }

  fireEvent.click(screen.getByRole("button", { name: "Scout" }));
  expect(screen.getByText("3 cards found")).toBeInTheDocument();
  expect(screen.getByText("2 by meaning")).toBeInTheDocument();
  expect(screen.getByText("2 by matching words")).toBeInTheDocument();
  expect(screen.getByText("1 found both ways")).toBeInTheDocument();
  expect(screen.getByText(/Apple Inc\. · Founding/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Judge" }));
  expect(screen.getByText("Kept: the best 1 of 3")).toBeInTheDocument();
  expect(screen.getByText("Set aside: 2 cards")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Storyteller" }));
  expect(screen.getByText("cited as [1]")).toBeInTheDocument();
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
    within(bubble).getByText("Fingerprinting your question."),
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
    await screen.findByText("Keeping the best of 2 cards."),
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
