import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { PrivateTextsProvider } from "../../lib/PrivateTexts";
import UploadPage from "./page";

const emitted = vi.hoisted(() => [] as { name: string; data?: unknown }[]);
vi.mock("../../components/office/OfficeRoom", () => ({ default: () => null }));
vi.mock("../../lib/office/useSceneQueue", () => {
  const queue = {
    register: () => () => undefined,
    emit: (event: { name: string }) => emitted.push(event),
    clear: () => undefined,
  };
  return { useSceneQueue: () => queue };
});

beforeEach(() => {
  emitted.length = 0;
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
      if (url.endsWith("/library")) {
        return Promise.resolve(
          new Response(JSON.stringify([{ id: 1, title: "Starter doc", chunk_count: 4 }])),
        );
      }
      return Promise.resolve(ndjson(events));
    }),
  );
}

function paste(title: string, text: string) {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: title } });
  fireEvent.change(screen.getByLabelText("Text"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Add text" }));
}

test("lists the starter library and says where text is sent", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  expect(await screen.findByRole("link", { name: "Starter doc" })).toHaveAttribute(
    "href",
    "/library/1",
  );
  expect(screen.getByText(/Sent to Voyage/)).toBeInTheDocument();
});

test("shows a character counter", () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  fireEvent.change(screen.getByLabelText("Text"), { target: { value: "hello" } });
  expect(screen.getByText("5 / 20,000")).toBeInTheDocument();
});

test("pasting a text adds it under your books and empties the form", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");

  expect(await screen.findByRole("link", { name: "My note" })).toHaveAttribute("href", "/texts/0");
  await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue(""));
  expect(screen.getByRole("button", { name: "Remove My note" })).toBeInTheDocument();
});

test("the speech bubbles follow the steps and show the real card count", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");
  await screen.findByRole("link", { name: "My note" });

  expect(
    within(screen.getByRole("group", { name: "Chopper" })).getByText("Done"),
  ).toBeInTheDocument();
  expect(screen.getByText("Cut into 2 cards.")).toBeInTheDocument();
  expect(
    within(screen.getByRole("group", { name: "Translator" })).getByText("Done"),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("group", { name: "Archivist" })).getByText("Done"),
  ).toBeInTheDocument();
});

test("a full upload plays the scenes in order, with the Archivist around adding the text", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");
  await screen.findByRole("link", { name: "My note" });

  expect(emitted.map((e) => e.name)).toEqual([
    "chopper_start",
    "chopper_done",
    "translator_start",
    "translator_done",
    "archivist_start",
    "archivist_done",
  ]);
});

test("the What happened panel shows the real cards and fingerprints", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  expect(screen.getByText("Send a text to see this step.")).toBeInTheDocument();
  paste("My note", "hello");

  expect(await screen.findByText(/2 cards from 200 characters/)).toBeInTheDocument();
  expect(screen.getByText("Intro")).toBeInTheDocument();
  expect(screen.getByTitle("Characters 1–120")).toBeInTheDocument();
  expect(screen.getByTitle("Characters 101–200")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Translator" }));
  expect(screen.getByText(/2 fingerprints/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Archivist" }));
  expect(screen.getAllByText("Filed with your books, in this tab only.").length).toBeGreaterThan(0);
});

test("a failed step shows an error on the running character and in an alert", async () => {
  stubBackend([
    { step: "chopper", status: "start" },
    { step: "error", status: "done", data: { message: "Upload failed" } },
  ]);
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");

  expect(await screen.findByRole("alert")).toHaveTextContent("Upload failed");
  expect(
    within(screen.getByRole("group", { name: "Chopper" })).getByText("Error"),
  ).toBeInTheDocument();
  expect(emitted.map((e) => e.name)).toEqual(["chopper_start", "error"]);
  // nothing was added, so the form keeps the text
  expect(screen.getByLabelText("Title")).toHaveValue("My note");
});

test("removing a book deletes it from the file cabinet", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  paste("My note", "hello");
  fireEvent.click(await screen.findByRole("button", { name: "Remove My note" }));
  expect(screen.queryByRole("link", { name: "My note" })).toBeNull();
});

test("the button stays disabled until there is a title and text", () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  expect(screen.getByRole("button", { name: "Add text" })).toBeDisabled();
});
