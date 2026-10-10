import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { resetMapCache, useMapPoints } from "./map";

const POINTS = [
  { chunk_id: 1, document_id: 1, title: "Apple Inc.", position: 0, heading: null, x: 0, y: 0 },
];

beforeEach(() => resetMapCache());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("fetches /map once even with two hooks mounted", async () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(POINTS))));
  vi.stubGlobal("fetch", fetchMock);
  const a = renderHook(() => useMapPoints(true));
  const b = renderHook(() => useMapPoints(true));
  await waitFor(() => expect(a.result.current.points).toEqual(POINTS));
  await waitFor(() => expect(b.result.current.points).toEqual(POINTS));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("does not fetch until enabled", async () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(POINTS))));
  vi.stubGlobal("fetch", fetchMock);
  const { result, rerender } = renderHook(({ on }) => useMapPoints(on), {
    initialProps: { on: false },
  });
  expect(fetchMock).not.toHaveBeenCalled();
  rerender({ on: true });
  await waitFor(() => expect(result.current.points).toEqual(POINTS));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("reports an error on a failed response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response("nope", { status: 500 }))),
  );
  const { result } = renderHook(() => useMapPoints(true));
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.points).toBeNull();
  await act(async () => {});
});
