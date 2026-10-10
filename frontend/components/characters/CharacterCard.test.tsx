import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import CharacterCard from "./CharacterCard";

afterEach(cleanup);

function card() {
  return render(
    <CharacterCard
      name="Scout"
      room="/office/ask-room.svg"
      part="sc"
      role="cuts your text into cards"
      phase="waiting"
      plain="I search two ways."
      thisRun={<p>Nothing yet.</p>}
      tech={["pgvector · cosine"]}
      how="Meaning search uses pgvector."
      settings={[["Cards per search", "20"]]}
      extra={<p>Extra inside</p>}
    />,
  );
}

test("shows the name, a sentence role, status and plain words in the bubble, and this run", () => {
  card();
  expect(screen.getByRole("heading", { name: "Scout" })).toBeInTheDocument();
  expect(screen.getByText("Cuts your text into cards.")).toBeInTheDocument();
  expect(screen.getByText("Waiting")).toBeInTheDocument();
  expect(screen.getByText("I search two ways.")).toBeInTheDocument();
  expect(screen.queryByText("In plain words")).toBeNull();
  expect(screen.queryByText("This run")).toBeNull();
  expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
});

test("this run comes after the intro and before Under the hood", () => {
  card();
  const plain = screen.getByText("I search two ways.");
  const run = screen.getByText("Nothing yet.");
  const hood = screen.getByText("Under the hood");
  expect(plain.compareDocumentPosition(run) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(run.compareDocumentPosition(hood) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("Under the hood is collapsed until opened, then shows chips, settings and extra", () => {
  const { container } = card();
  const hood = container.querySelector("details")!;
  expect(screen.getByText("Under the hood")).toBeInTheDocument();
  expect(hood.open).toBe(false);
  fireEvent.click(screen.getByText("Under the hood"));
  expect(hood.open).toBe(true);
  expect(hood).toContainElement(screen.getByText("pgvector · cosine"));
  expect(hood).toContainElement(screen.getByText("Cards per search"));
  expect(hood).toContainElement(screen.getByText("20"));
  expect(hood).toContainElement(screen.getByText("Extra inside"));
});
