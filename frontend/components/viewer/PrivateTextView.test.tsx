import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { PrivateTextsProvider, usePrivateTexts } from "../../lib/PrivateTexts";
import { pdfFiles } from "../../lib/pdfFiles";
import PrivateTextView from "./PrivateTextView";

vi.mock("next/dynamic", () => ({
  default: () =>
    function PdfStub({ file, page, onError }: { file: Blob; page: number | null; onError: () => void }) {
      return (
        <div data-testid="pdf-view" data-page={page} data-name={(file as File).name}>
          <button onClick={onError}>fail</button>
        </div>
      );
    },
}));

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

const PDF_CHUNKS = [
  { position: 0, heading: null, page: 1, text: "Page one text." },
  { position: 1, heading: null, page: 2, text: "Page two text." },
];

function SeedPdf({ kept }: { kept: boolean }) {
  const { texts, add } = usePrivateTexts();
  if (texts.length === 0) {
    if (kept) pdfFiles.set("p1", new File(["%PDF"], "handbook.pdf", { type: "application/pdf" }));
    add({ id: "p1", pdf: true, title: "Handbook", text: "joined text", chunks: PDF_CHUNKS, vectors: [] });
  }
  return <PrivateTextView index={0} chunk={1} />;
}

test("a PDF still in memory is shown page by page at the cited page", () => {
  render(
    <PrivateTextsProvider>
      <SeedPdf kept />
    </PrivateTextsProvider>,
  );
  expect(screen.getByTestId("pdf-view")).toHaveAttribute("data-page", "2");
  expect(screen.queryByText("The PDF is no longer open in this tab, so the text is shown instead.")).toBeNull();
});

test("if the PDF cannot be drawn, the text is shown instead", () => {
  render(
    <PrivateTextsProvider>
      <SeedPdf kept />
    </PrivateTextsProvider>,
  );
  fireEvent.click(screen.getByText("fail"));
  expect(screen.queryByTestId("pdf-view")).toBeNull();
  expect(screen.getByText("Page two text.")).toBeInTheDocument();
});

test("without the file (after a reload) the text view and one line of note are shown", () => {
  pdfFiles.remove("p1");
  render(
    <PrivateTextsProvider>
      <SeedPdf kept={false} />
    </PrivateTextsProvider>,
  );
  expect(screen.queryByTestId("pdf-view")).toBeNull();
  expect(
    screen.getByText("The PDF is no longer open in this tab, so the text is shown instead."),
  ).toBeInTheDocument();
  expect(screen.getByText("Page two text.")).toBeInTheDocument();
});

test("Download saves the original PDF when it is in memory", () => {
  const create = vi.fn(() => "blob:pdf");
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(
    <PrivateTextsProvider>
      <SeedPdf kept />
    </PrivateTextsProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Download" }));
  const saved = (create.mock.calls[0] as unknown as [File])[0];
  expect(saved.name).toBe("handbook.pdf");
});
