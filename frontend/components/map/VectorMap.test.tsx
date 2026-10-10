import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import type { MapOverlay, MapPoint } from "../../lib/map";
import { PrivateTextsProvider, usePrivateTexts } from "../../lib/PrivateTexts";
import VectorMap, { PALETTE } from "./VectorMap";

afterEach(cleanup);

const POINTS: MapPoint[] = [
  { chunk_id: 1, document_id: 1, title: "Apple Inc.", position: 0, heading: "History", x: 0, y: 0 },
  { chunk_id: 2, document_id: 1, title: "Apple Inc.", position: 1, heading: null, x: 1, y: 1 },
  { chunk_id: 3, document_id: 2, title: "Vector database", position: 0, heading: "Index", x: 2, y: 0 },
];

function Seed() {
  const { add } = usePrivateTexts();
  return (
    <button
      onClick={() =>
        add({
          title: "My note",
          text: "hello",
          chunks: [{ position: 0, heading: null, text: "hello" }],
          vectors: [[0.1]],
          points: [{ x: 0.5, y: 0.5 }],
        })
      }
    >
      seed
    </button>
  );
}

function renderMap(props: {
  points?: MapPoint[] | null;
  error?: boolean;
  overlay?: MapOverlay;
  variant?: "full" | "compact";
  focus?: string | null;
}) {
  const { points = POINTS, error = false, overlay, variant, focus } = props;
  const view = render(
    <PrivateTextsProvider>
      <Seed />
      <VectorMap points={points} error={error} overlay={overlay}
        variant={variant}
        focus={focus}
      />
    </PrivateTextsProvider>,
  );
  return view;
}

const svg = () => screen.getByRole("img", { name: /Vector map/ });

test("draws a dot per library card coloured by document, the visitor's squares and a legend", () => {
  const { container } = renderMap({});
  fireEvent.click(screen.getByText("seed"));
  const dots = container.querySelectorAll("circle[data-key^='l:']");
  expect(dots).toHaveLength(3);
  expect(new Set([...dots].map((d) => d.getAttribute("fill"))).size).toBe(2);
  expect(container.querySelectorAll("rect[data-key^='p:']")).toHaveLength(1);
  const legend = screen.getByRole("list", { name: "Documents on the map" });
  expect(legend).toHaveTextContent("Apple Inc.");
  expect(legend).toHaveTextContent("Vector database");
  expect(screen.getByRole("list", { name: "Map key" })).toHaveTextContent("Your text");
});

test("draws the question, a line per candidate and two rings for a both candidate", () => {
  const overlay: MapOverlay = {
    question: { x: 0.2, y: 0.2 },
    candidates: [
      { source: "library", document_id: 1, title: "Apple Inc.", position: 0, rank: 1, found_by: "both" },
      { source: "library", document_id: 2, title: "Vector database", position: 0, rank: 2, found_by: "vector" },
    ],
  };
  const { container } = renderMap({ overlay });
  expect(screen.getByTestId("question-marker").querySelector("path")).not.toBeNull();
  expect(screen.getAllByTestId("candidate-line")).toHaveLength(2);
  const rings = screen.getAllByTestId("candidate-ring");
  expect(rings.map((g) => g.querySelectorAll("circle").length)).toEqual([2, 1]);
  expect(container.querySelector("circle[data-key='l:1:1']")).toHaveAttribute("opacity", "0.35");
});

test("hovering a dot shows its title and heading, leaving hides them", () => {
  const { container } = renderMap({});
  const dot = container.querySelector("circle[data-key='l:1:0']")!;
  fireEvent.pointerEnter(dot);
  const tip = screen.getByRole("tooltip");
  expect(tip).toHaveTextContent("Apple Inc.");
  expect(tip).toHaveTextContent("History");
  fireEvent.pointerLeave(dot);
  expect(screen.queryByRole("tooltip")).toBeNull();
});

test("Reset view restores the view that Zoom in changed", () => {
  renderMap({});
  const first = svg().getAttribute("viewBox");
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(svg().getAttribute("viewBox")).not.toBe(first);
  fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
  expect(svg().getAttribute("viewBox")).toBe(first);
});

test("a plain wheel does not zoom the map, Ctrl + wheel does", () => {
  renderMap({});
  const first = svg().getAttribute("viewBox");
  fireEvent.wheel(svg(), { deltaY: -100 });
  expect(svg().getAttribute("viewBox")).toBe(first);
  fireEvent.wheel(svg(), { deltaY: -100, ctrlKey: true });
  expect(svg().getAttribute("viewBox")).not.toBe(first);
});

test("two documents get two different colours from the palette", () => {
  const { container } = renderMap({});
  const fills = [...container.querySelectorAll("circle[data-key^='l:']")].map((d) =>
    d.getAttribute("fill"),
  );
  expect(new Set(fills).size).toBe(2);
  for (const fill of fills) expect(PALETTE).toContain(fill);
});

test("shows loading, error and empty states", () => {
  const { rerender } = renderMap({ points: null });
  expect(screen.getByText("Loading the map…")).toBeInTheDocument();
  rerender(
    <PrivateTextsProvider>
      <VectorMap points={null} error />
    </PrivateTextsProvider>,
  );
  expect(screen.getByText("The map is not available right now.")).toBeInTheDocument();
  rerender(
    <PrivateTextsProvider>
      <VectorMap points={[]} error={false} />
    </PrivateTextsProvider>,
  );
  expect(screen.getByText(/No map yet: run/)).toBeInTheDocument();
});

const OVERLAY: MapOverlay = {
  question: { x: 1.9, y: 0.1 },
  candidates: [
    { source: "library", document_id: 2, title: "Vector database", position: 0, rank: 2, found_by: "vector" },
  ],
};

test("compact starts fitted to the question and candidates, and Reset view returns there", () => {
  renderMap({});
  const whole = svg().getAttribute("viewBox");
  cleanup();
  renderMap({ overlay: OVERLAY, variant: "compact" });
  const fitted = svg().getAttribute("viewBox");
  const width = (box: string | null) => Number(box!.split(" ")[2]);
  expect(width(fitted)).toBeLessThan(width(whole));
  expect(screen.queryByRole("list", { name: "Documents on the map" })).toBeNull();
  const legend = screen.getByRole("list", { name: "Map key" });
  expect(legend).toHaveTextContent("Your question");
  expect(legend).toHaveTextContent("Found by meaning");
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(svg().getAttribute("viewBox")).not.toBe(fitted);
  fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
  expect(svg().getAttribute("viewBox")).toBe(fitted);
});

test("compact with no overlay shows the whole map", () => {
  renderMap({});
  const whole = svg().getAttribute("viewBox");
  cleanup();
  renderMap({ variant: "compact" });
  expect(svg().getAttribute("viewBox")).toBe(whole);
});

test("compact draws a rank label per candidate, the full map does not", () => {
  const { container } = renderMap({ overlay: OVERLAY, variant: "compact" });
  expect(screen.getAllByTestId("candidate-rank").map((t) => t.textContent)).toEqual(["2"]);
  cleanup();
  renderMap({ overlay: OVERLAY });
  expect(screen.queryAllByTestId("candidate-rank")).toHaveLength(0);
  expect(container).toBeDefined();
});

test("Whole map sets the view to the full bounds in compact", () => {
  renderMap({});
  const whole = svg().getAttribute("viewBox");
  cleanup();
  renderMap({ overlay: OVERLAY, variant: "compact" });
  expect(svg().getAttribute("viewBox")).not.toBe(whole);
  fireEvent.click(screen.getByRole("button", { name: "Whole map" }));
  expect(svg().getAttribute("viewBox")).toBe(whole);
});

test("focus thickens one candidate's ring and fades the others", () => {
  const overlay: MapOverlay = {
    question: { x: 0.2, y: 0.2 },
    candidates: [
      { source: "library", document_id: 1, title: "Apple Inc.", position: 0, rank: 1, found_by: "vector" },
      { source: "library", document_id: 2, title: "Vector database", position: 0, rank: 2, found_by: "vector" },
    ],
  };
  renderMap({ overlay, focus: "l:2:0" });
  const [first, second] = screen.getAllByTestId("candidate-ring");
  const width = (g: Element) => Number(g.querySelector("circle")!.getAttribute("stroke-width"));
  expect(width(second)).toBeGreaterThan(width(first));
  expect(first).toHaveAttribute("opacity", "0.4");
  expect(second).toHaveAttribute("opacity", "1");
});
