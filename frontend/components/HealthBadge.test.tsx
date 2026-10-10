import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { resetHealthCache } from "../lib/health";
import HealthBadge from "./HealthBadge";

beforeEach(() => {
  resetHealthCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows checking until the backend answers", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<HealthBadge />);
  expect(screen.getByText("Checking library…")).toBeInTheDocument();
});

test("shows online when /health is ok", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
  render(<HealthBadge />);
  expect(await screen.findByText("Library online")).toBeInTheDocument();
});

test("shows offline when the request fails", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
  render(<HealthBadge />);
  expect(await screen.findByText("Library offline")).toBeInTheDocument();
});
