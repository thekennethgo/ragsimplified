import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { type About, llmName, resetAboutCache, useAbout } from "./about";

const ABOUT = {
  embedder: { provider: "Voyage AI", model: "voyage-4", dimensions: 1024 },
  llm: { provider: "anthropic", model: "claude-x", max_tokens: 1024 },
} as About;

beforeEach(() => {
  resetAboutCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("two hooks mounted together send one /about request", async () => {
  const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(ABOUT) }));
  vi.stubGlobal("fetch", fetchMock);
  const first = renderHook(() => useAbout());
  const second = renderHook(() => useAbout());
  await waitFor(() => expect(first.result.current).toEqual(ABOUT));
  await waitFor(() => expect(second.result.current).toEqual(ABOUT));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("a failed fetch leaves it null", async () => {
  const fetchMock = vi.fn(() => Promise.reject(new Error("down")));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useAbout());
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(result.current).toBeNull();
});

test("llmName turns a model id into its maker and name", () => {
  const named = (model: string) => llmName({ llm: { provider: "", model, max_tokens: 1 } } as About);
  expect(named("gemini-3.5-flash-lite")).toBe("Google Gemini");
  expect(named("claude-haiku-4-5")).toBe("Anthropic Claude");
  expect(named("llama-3")).toBe("llama-3");
  expect(llmName(null)).toBe("…");
});
