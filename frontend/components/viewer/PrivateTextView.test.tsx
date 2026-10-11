import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { PrivateTextsProvider, usePrivateTexts } from "../../lib/PrivateTexts";
import PrivateTextView from "./PrivateTextView";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Seed() {
  const { texts, add } = usePrivateTexts();
  if (texts.length === 0) {
    add({ title: "My notes: day 1!", text: "Hello pasted world", chunks: [], vectors: [] });
  }
  return <PrivateTextView index={0} chunk={null} />;
}

test("Download saves the pasted text as a .txt Blob and revokes the object URL", () => {
  const create = vi.fn(() => "blob:x");
  const revoke = vi.fn();
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(
    <PrivateTextsProvider>
      <Seed />
    </PrivateTextsProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Download" }));
  const blob = (create.mock.calls[0] as unknown as [Blob])[0];
  expect(blob).toBeInstanceOf(Blob);
  expect(blob.size).toBe("Hello pasted world".length);
  expect(click).toHaveBeenCalled();
  expect(revoke).toHaveBeenCalledWith("blob:x");
});

function SeedMarkdown() {
  const { texts, add } = usePrivateTexts();
  if (texts.length === 0) {
    add({
      title: "Notes",
      text: "x",
      chunks: [
        { position: 0, heading: null, text: "## Heading\n\nA first paragraph that ends here ok." },
        {
          position: 1,
          heading: null,
          text: "A first paragraph that ends here ok.\n\n- second item",
        },
      ],
      vectors: [],
    });
  }
  return <PrivateTextView index={0} chunk={1} />;
}

test("renders Markdown in the reading layout and drops the overlap", () => {
  const { container } = render(
    <PrivateTextsProvider>
      <SeedMarkdown />
    </PrivateTextsProvider>,
  );
  expect(screen.getByRole("heading", { level: 2, name: "Heading" })).toBeInTheDocument();
  expect(screen.getByRole("listitem")).toHaveTextContent("second item");
  expect(screen.getAllByText("A first paragraph that ends here ok.")).toHaveLength(1);
  expect(screen.getByText("Cited")).toBeInTheDocument();
  expect(container.querySelector("pre")).toBeNull();
});
