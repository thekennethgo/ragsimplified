import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { afterEach, expect, test, vi } from "vitest";

import PdfView, { pageWidth } from "./PdfView";

vi.mock("react-pdf", () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({
    children,
    onLoadSuccess,
  }: {
    children: ReactNode;
    onLoadSuccess: (pdf: { numPages: number }) => void;
  }) => {
    useEffect(() => onLoadSuccess({ numPages: 2 }), [onLoadSuccess]);
    return <div>{children}</div>;
  },
  Page: ({
    pageNumber,
    width,
    onLoadSuccess,
    onRenderTextLayerSuccess,
  }: {
    pageNumber: number;
    width: number;
    onLoadSuccess?: (page: { originalWidth: number; originalHeight: number }) => void;
    onRenderTextLayerSuccess?: () => void;
  }) => {
    useEffect(() => onLoadSuccess?.({ originalWidth: 595, originalHeight: 842 }), [onLoadSuccess]);
    return <div data-testid={`page-${pageNumber}`} data-width={width} onClick={onRenderTextLayerSuccess} />;
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const A4 = 595 / 842;

test("only the first text-layer render scrolls, until a new viewer is opened", async () => {
  const scroll = vi.fn();
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scroll;
  try {
    const props = { file: "/cv.pdf", page: 1, citedText: "Experience", onError: () => {} };
    const view = render(<PdfView key="first" {...props} />);
    fireEvent.click(await screen.findByTestId("page-1"));
    expect(scroll).toHaveBeenCalledTimes(1);

    view.rerender(<PdfView key="first" {...props} />);
    fireEvent.click(screen.getByTestId("page-1"));
    fireEvent.click(screen.getByTestId("page-1"));
    expect(scroll).toHaveBeenCalledTimes(1);

    view.rerender(<PdfView key="second" {...props} page={2} />);
    fireEvent.click(await screen.findByTestId("page-2"));
    expect(scroll).toHaveBeenCalledTimes(2);
  } finally {
    HTMLElement.prototype.scrollIntoView = original;
  }
});

test("a page fits whole: the width is capped by the viewer height, 720 and the viewer width", () => {
  // (600 - 48) x 0.707 = about 390.
  expect(pageWidth(1000, 600, A4)).toBe(390);
  expect(pageWidth(1000, 3000, A4)).toBe(720);
  expect(pageWidth(300, 3000, A4)).toBe(300);
  // Before the page's shape is known, only the width limits apply.
  expect(pageWidth(1000, 600, null)).toBe(720);
});

test("inside a scrolling viewer the page width follows the viewer's height", async () => {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  render(
    <div style={{ overflowY: "auto" }}>
      <PdfView file="/corpus/lore/staff-handbook.pdf" page={null} citedText={null} onError={() => {}} />
    </div>,
  );
  await waitFor(() => expect(screen.getByTestId("page-1")).toHaveAttribute("data-width", "390"));
  expect(screen.getByTestId("page-2")).toHaveAttribute("data-width", "390");
});

test("with no scrolling viewer (the full-page route) the window's height is used", async () => {
  vi.stubGlobal("innerHeight", 600);
  render(
    <PdfView file="/corpus/lore/staff-handbook.pdf" page={null} citedText={null} onError={() => {}} />,
  );
  await waitFor(() => expect(screen.getByTestId("page-1")).toHaveAttribute("data-width", "390"));
  vi.unstubAllGlobals();
});
