import { useEffect, useState } from "react";

import { backendUrl } from "./backend";

export type MapPoint = {
  chunk_id: number;
  document_id: number;
  title: string;
  position: number;
  heading: string | null;
  x: number;
  y: number;
};

export type Point = { x: number; y: number };

/** One card the Scout found, enough to find its dot on the map. */
export type Candidate = {
  source: "library" | "private";
  document_id: number | null;
  title: string;
  position: number;
  rank: number;
  found_by: "vector" | "keyword" | "both";
};

/** How a card was found: the colours shared by the map's rings and the Scout list's rank badges. */
export const FOUND_BY_COLOR = {
  vector: "#3b5878",
  keyword: "#c98a2b",
  both: "linear-gradient(135deg, #3b5878 50%, #c98a2b 50%)",
} as const;

/** What the Ask page draws on top of the map: the question and the Scout's candidates. */
export type MapOverlay = { question?: Point; candidates?: Candidate[] };

/** Same document-and-position key for library dots and Scout candidates; private ones use the title. */
export const keyOf = (c: {
  source: "library" | "private";
  document_id: number | null;
  title: string;
  position: number;
}) => (c.source === "library" ? `l:${c.document_id}:${c.position}` : `p:${c.title}:${c.position}`);

let cache: Promise<MapPoint[]> | null = null;

/** Clears the shared GET /map result (tests only). */
export function resetMapCache() {
  cache = null;
}

/** GET /map once per page load, shared by every map; starts when `enabled` first becomes true. */
export function useMapPoints(enabled: boolean): {
  points: MapPoint[] | null;
  error: boolean;
} {
  const [points, setPoints] = useState<MapPoint[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const request = (cache ??= fetch(`${backendUrl()}/map`).then((r) =>
      r.ok ? (r.json() as Promise<MapPoint[]>) : Promise.reject(r.status),
    ));
    request
      .then((result) => live && setPoints(result))
      .catch(() => {
        cache = null;
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, [enabled]);

  return { points, error };
}
