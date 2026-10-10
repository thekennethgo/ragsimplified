import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import EnvelopeForm from "./EnvelopeForm";

afterEach(cleanup);

const file = (name: string, content: string, type = "text/plain") =>
  new File([content], name, { type });

function pick(input: HTMLElement, f: File) {
  fireEvent.change(input, { target: { files: [f] } });
}

test("the send button is named Add text and waits for a title and text", () => {
  render(<EnvelopeForm onSubmit={vi.fn()} busy={false} offline={false} />);
  expect(screen.getByRole("button", { name: "Add text" })).toBeDisabled();
  expect(screen.getByText("Send to your folder")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Note" } });
  fireEvent.change(screen.getByLabelText("Text"), { target: { value: "hello" } });
  expect(screen.getByRole("button", { name: "Add text" })).toBeEnabled();
  expect(screen.getByText("5 / 20,000")).toBeInTheDocument();
});

test("submitting hands over the title and text, and the form empties when it was added", async () => {
  const onSubmit = vi.fn(() => Promise.resolve(true));
  render(<EnvelopeForm onSubmit={onSubmit} busy={false} offline={false} />);
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Note" } });
  fireEvent.change(screen.getByLabelText("Text"), { target: { value: "hello" } });
  fireEvent.click(screen.getByRole("button", { name: "Add text" }));
  expect(onSubmit).toHaveBeenCalledWith("Note", "hello");
  await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue(""));
  expect(screen.getByLabelText("Text")).toHaveValue("");
});

test("a failed submit keeps what was typed", async () => {
  const onSubmit = vi.fn(() => Promise.resolve(false));
  render(<EnvelopeForm onSubmit={onSubmit} busy={false} offline={false} />);
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Note" } });
  fireEvent.change(screen.getByLabelText("Text"), { target: { value: "hello" } });
  fireEvent.click(screen.getByRole("button", { name: "Add text" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  expect(screen.getByLabelText("Title")).toHaveValue("Note");
});

test("a .md file is read into the form and its name becomes the title", async () => {
  render(<EnvelopeForm onSubmit={vi.fn()} busy={false} offline={false} />);
  pick(
    screen.getByLabelText(/Pick or drop a file/),
    file("Sourdough notes.md", "# Starter\nFeed it.", "text/markdown"),
  );
  await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue("Sourdough notes"));
  expect(screen.getByLabelText("Text")).toHaveValue("# Starter\nFeed it.");
});

test("a dropped .txt file is read too", async () => {
  render(<EnvelopeForm onSubmit={vi.fn()} busy={false} offline={false} />);
  const drop = screen.getByText(/Pick or drop a file/);
  fireEvent.drop(drop, { dataTransfer: { files: [file("diary.TXT", "dear diary")] } });
  await waitFor(() => expect(screen.getByLabelText("Text")).toHaveValue("dear diary"));
  expect(screen.getByLabelText("Title")).toHaveValue("diary");
});

test("a file longer than 20,000 characters is cut with a visible note", async () => {
  render(<EnvelopeForm onSubmit={vi.fn()} busy={false} offline={false} />);
  pick(screen.getByLabelText(/Pick or drop a file/), file("long.txt", "a".repeat(25_000)));
  await waitFor(() => expect(screen.getByText("20,000 / 20,000")).toBeInTheDocument());
  expect(screen.getByText("Cut to the first 20,000 characters.")).toBeInTheDocument();
});

test("any other file type gets a friendly error and changes nothing", async () => {
  render(<EnvelopeForm onSubmit={vi.fn()} busy={false} offline={false} />);
  pick(screen.getByLabelText(/Pick or drop a file/), file("photo.png", "x", "image/png"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Only .md and .txt files");
  expect(screen.getByLabelText("Text")).toHaveValue("");
});
