import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { resetHealthCache, useBackendHealth } from "./health";

beforeEach(() => {
  resetHealthCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("two hooks mounted together send one /health request", async () => {
  const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  const first = renderHook(() => useBackendHealth());
  const second = renderHook(() => useBackendHealth());
  await waitFor(() => expect(first.result.current).toBe("online"));
  await waitFor(() => expect(second.result.current).toBe("online"));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("a failed fetch means offline", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
  const { result } = renderHook(() => useBackendHealth());
  expect(result.current).toBe("checking");
  await waitFor(() => expect(result.current).toBe("offline"));
});
