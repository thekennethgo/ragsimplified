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
import { PrivateTextsProvider } from "../../lib/PrivateTexts";
import UploadPage from "./page";

const ABOUT = {
  embedder: { provider: "Voyage AI", model: "voyage-4", dimensions: 1024 },
  reranker: { provider: "Voyage AI", model: "rerank-3-lite" },
  llm: { provider: "openai_compatible", model: "gemini-3.5-flash-lite", max_tokens: 1024 },
  chopper: { chunk_tokens: 500, overlap_tokens: 50, chars_per_token: 4, max_text_chars: 20000 },
  translator: { max_weighted_words: 40 },
  scout: { candidates: 20, rrf_k: 60, max_private_chunks: 60 },
  judge: { keep: 5 },
  storyteller_prompt: "STUB SYSTEM PROMPT",
};

const emitted = vi.hoisted(() => [] as { name: string; data?: unknown }[]);
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
  resetHealthCache();
  resetAboutCache();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function ndjson(lines: object[]): Response {
  const body = lines.map((line) => JSON.stringify(line)).join("\n") + "\n";
  return new Response(body);
}

const UPLOAD_EVENTS = [
  { step: "chopper", status: "start" },
  {
    step: "chopper",
    status: "done",
    data: {
      chunks: 2,
      chunk_details: [
        { position: 0, heading: "Intro", length: 120, overlap: 0 },
        { position: 1, heading: null, length: 100, overlap: 20 },
      ],
    },
  },
  { step: "translator", status: "start" },
  {
    step: "translator",
    status: "done",
    data: {
      title: "My note",
      chunks: [
        { position: 0, heading: "Intro", text: "hello" },
        { position: 1, heading: null, text: "world" },
      ],
      vectors: [
        [0.1, -0.2],
        [0.3, 0.4],
      ],
    },
  },
];

function stubBackend(events: object[] = UPLOAD_EVENTS) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.endsWith("/health")) return Promise.resolve(new Response("{}"));
      if (url.endsWith("/about")) return Promise.resolve(new Response(JSON.stringify(ABOUT)));
      if (url.endsWith("/library")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([{ id: 1, title: "Starter doc", chunk_count: 4 }]),
          ),
        );
      }
      return Promise.resolve(ndjson(events));
    }),
  );
}

const openDocuments = () => fireEvent.click(screen.getByRole("button", { name: "Documents" }));

function paste(title: string, text: string) {
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: title },
  });
  fireEvent.change(screen.getByLabelText("Text"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Add text" }));
}

test("lists the starter library and says where text is sent", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  openDocuments();
  expect(await screen.findByRole("button", { name: "Starter doc" })).toBeInTheDocument();
  expect(screen.getByText(/Sent to Voyage/)).toBeInTheDocument();
});

test("shows a character counter", () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  fireEvent.change(screen.getByLabelText("Text"), {
    target: { value: "hello" },
  });
  expect(screen.getByText("5 / 20,000")).toBeInTheDocument();
});

test("pasting a text adds it under your books and empties the form", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");
  openDocuments();

  expect(await screen.findByRole("button", { name: "My note" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue(""));
  expect(
    screen.getByRole("button", { name: "Remove My note" }),
  ).toBeInTheDocument();
});

test("a speech bubble shows only while its character is working", async () => {
  stubBackend([{ step: "chopper", status: "start" }]);
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  expect(screen.queryByRole("group", { name: "Chopper" })).toBeNull();
  paste("My note", "hello");

  const bubble = await screen.findByRole("group", { name: "Chopper" });
  expect(
    within(bubble).getByText(
      'Cutting "My note" into cards…',
    ),
  ).toBeInTheDocument();
  expect(within(bubble).queryByText("Working")).toBeNull();
  expect(screen.queryByRole("group", { name: "Translator" })).toBeNull();
  expect(screen.queryByRole("group", { name: "Archivist" })).toBeNull();
});

test("no speech bubble is left once every step is done", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");
  openDocuments();
  await screen.findByRole("button", { name: "My note" });

  for (const name of ["Chopper", "Translator", "Archivist"]) {
    expect(screen.queryByRole("group", { name })).toBeNull();
  }
});

test("a full upload plays the scenes in order, with the Archivist around adding the text", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");
  openDocuments();
  await screen.findByRole("button", { name: "My note" });

  expect(emitted.map((e) => e.name)).toEqual([
    "chopper_start",
    "chopper_done",
    "translator_start",
    "translator_done",
    "archivist_start",
    "archivist_done",
  ]);
});

test("the Meet the team panel shows the real cards and fingerprints", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  expect(
    screen.getByText("Nothing yet. Send a text to see what I do with it."),
  ).toBeInTheDocument();
  paste("My note", "hello");

  // the panel follows the newest step with results; go back to the Chopper's
  openDocuments();
  await screen.findByRole("button", { name: "My note" });
  fireEvent.click(screen.getByRole("button", { name: "Chopper" }));
  expect(
    await screen.findByText(/2 cards from 200 characters/),
  ).toBeInTheDocument();
  expect(screen.getByText("Intro")).toBeInTheDocument();
  expect(screen.getByTitle("Characters 1–120")).toBeInTheDocument();
  expect(screen.getByTitle("Characters 101–200")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Translator" }));
  expect(screen.getByText(/2 fingerprints/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Archivist" }));
  expect(
    screen.getAllByText("Filed in your folder. Only this tab can see it.").length,
  ).toBeGreaterThan(0);
});

test("a failed step shows an alert and takes the bubble away", async () => {
  stubBackend([
    { step: "chopper", status: "start" },
    { step: "error", status: "done", data: { message: "Upload failed" } },
  ]);
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");

  expect(await screen.findByRole("alert")).toHaveTextContent("Upload failed");
  expect(screen.queryByRole("group", { name: "Chopper" })).toBeNull();
  expect(emitted.map((e) => e.name)).toEqual(["chopper_start", "error"]);
  // nothing was added, so the form keeps the text
  expect(screen.getByLabelText("Title")).toHaveValue("My note");
});

test("the File cabinet has a Viewer button", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  expect(await screen.findByRole("button", { name: "Viewer" })).toBeInTheDocument();
});

test("a successful upload shows a filed toast whose action opens the text in the viewer", async () => {
  Element.prototype.scrollIntoView = vi.fn();
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");

  expect(await screen.findByRole("status")).toHaveTextContent(
    '"My note" is in your folder: 2 cards. Only this tab can see it.',
  );
  fireEvent.click(screen.getByRole("button", { name: "Open it in the viewer" }));
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("button", { name: "Viewer" })).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByRole("heading", { name: "My note" })).toBeInTheDocument();
});

test("a failed upload shows no filed toast", async () => {
  stubBackend([
    { step: "chopper", status: "start" },
    { step: "error", status: "done", data: { message: "Upload failed" } },
  ]);
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");

  await screen.findByRole("alert");
  expect(screen.queryByText(/is in your folder/)).toBeNull();
});

test("removing a book deletes it from the file cabinet", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");
  openDocuments();
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove My note" }),
  );
  expect(screen.queryByRole("button", { name: "My note" })).toBeNull();
});

test("the button stays disabled until there is a title and text", () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  expect(screen.getByRole("button", { name: "Add text" })).toBeDisabled();
});

test("the Animations switch is on by default and remembers its setting", () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  const toggle = screen.getByRole("switch", { name: /Animations/ });
  expect(toggle).toHaveAttribute("aria-checked", "true");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(localStorage.getItem("ragsimplified.animations")).toBe("off");
  fireEvent.click(toggle);
  expect(localStorage.getItem("ragsimplified.animations")).toBe("on");
  localStorage.removeItem("ragsimplified.animations");
});

test("once the Chopper tab is clicked mid-upload the panel stays there as later steps finish", async () => {
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
            : new Response(body),
      ),
    ),
  );
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");

  push(UPLOAD_EVENTS[0]);
  await waitFor(() =>
    expect(within(screen.getByRole("button", { name: "Chopper" })).getByTitle("working")).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Chopper" }));
  for (const event of UPLOAD_EVENTS.slice(1)) push(event);
  await waitFor(() =>
    expect(within(screen.getByRole("button", { name: "Translator" })).getByTitle("done")).toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: "Chopper" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Translator" })).toHaveAttribute("aria-pressed", "false");
  close();
});

test("when the library is offline the send button is disabled and a note shows", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url.endsWith("/health")
        ? Promise.reject(new Error("down"))
        : Promise.resolve(new Response("[]")),
    ),
  );
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  expect(await screen.findByRole("status")).toHaveTextContent(/library is offline/);
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "T" } });
  fireEvent.change(screen.getByLabelText("Text"), { target: { value: "x" } });
  expect(screen.getByRole("button", { name: "Add text" })).toBeDisabled();
});

test("every character tab is clickable before any upload, each with a Nothing yet line", () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  expect(screen.getByRole("heading", { name: "Meet the team" })).toBeInTheDocument();
  for (const name of ["Chopper", "Translator", "Archivist"]) {
    const tab = screen.getByRole("button", { name });
    expect(tab).toBeEnabled();
    fireEvent.click(tab);
    expect(tab).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("Nothing yet. Send a text to see what I do with it."),
    ).toBeInTheDocument();
  }
});

test("the Under the hood section names the real model from /about", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  fireEvent.click(screen.getByRole("button", { name: "Translator" }));
  expect((await screen.findAllByText(/voyage-4/)).length).toBeGreaterThan(0);
});

test("the speech bubble says what the Translator is doing with the real card count", async () => {
  stubBackend([
    UPLOAD_EVENTS[0],
    UPLOAD_EVENTS[1],
    { step: "translator", status: "start" },
  ]);
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");
  const bubble = await screen.findByRole("group", { name: "Translator" });
  expect(
    within(bubble).getByText(
      "Fingerprinting 2 cards…",
    ),
  ).toBeInTheDocument();
});
