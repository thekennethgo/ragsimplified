import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/font/google", () => ({
  IBM_Plex_Sans: () => ({ variable: "sans" }),
  IBM_Plex_Mono: () => ({ variable: "mono" }),
}));
vi.mock("../components/HealthBadge", () => ({ default: () => null }));
vi.mock("../components/Nav", () => ({ default: () => null }));

import RootLayout, { metadata } from "./layout";

afterEach(cleanup);

test("the site is titled RAG Visualised in the metadata and the header brand", () => {
  expect(metadata.title).toBe("RAG Visualised");
  render(<RootLayout>{null}</RootLayout>, { container: document.documentElement });
  expect(screen.getByText("RAG Visualised")).toBeInTheDocument();
  expect(screen.queryByText("ragsimplified")).toBeNull();
});
