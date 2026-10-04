import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { PrivateTextsProvider } from "../../lib/PrivateTexts";
import UploadPage from "./page";

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
  { step: "chopper", status: "done", data: { chunks: 1 } },
  { step: "translator", status: "start" },
  {
    step: "translator",
    status: "done",
    data: {
      title: "My note",
      chunks: [{ position: 0, heading: null, text: "hello" }],
      vectors: [[0.1, 0.2]],
    },
  },
];

function stubBackend() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.endsWith("/library")) {
        return Promise.resolve(
          new Response(JSON.stringify([{ id: 1, title: "Starter doc", chunk_count: 4 }])),
        );
      }
      return Promise.resolve(ndjson(UPLOAD_EVENTS));
    }),
  );
}

test("lists the starter library and says where text is sent", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  expect(await screen.findByText("Starter doc (4 chunks)")).toBeInTheDocument();
  expect(screen.getByText(/sent to Voyage/)).toBeInTheDocument();
});

test("shows a character counter", () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  fireEvent.change(screen.getByLabelText("Text"), { target: { value: "hello" } });
  expect(screen.getByText("5 / 20000")).toBeInTheDocument();
});

test("pasting a text logs the steps and adds it under your texts", async () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "My note" } });
  fireEvent.change(screen.getByLabelText("Text"), { target: { value: "hello" } });
  fireEvent.click(screen.getByRole("button", { name: "Add text" }));

  expect(await screen.findByText("My note (1 chunks)")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue(""));
  expect(screen.getByRole("region", { name: "Progress" })).toHaveTextContent("translator: done");
});

test("the button stays disabled until there is a title and text", () => {
  stubBackend();
  render(<UploadPage />, { wrapper: PrivateTextsProvider });
  expect(screen.getByRole("button", { name: "Add text" })).toBeDisabled();
});
