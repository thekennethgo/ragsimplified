"use client";

import { useEffect, useState } from "react";

import { backendUrl } from "./backend";

export type Health = "checking" | "online" | "offline";

let cache: Promise<boolean> | null = null;

/** Clears the shared GET /health result (tests only). */
export function resetHealthCache() {
  cache = null;
}

/** GET /health once per page load, shared by everything that asks. */
export function useBackendHealth(): Health {
  const [status, setStatus] = useState<Health>("checking");

  useEffect(() => {
    let live = true;
    const request = (cache ??= fetch(`${backendUrl()}/health`, {
      signal: AbortSignal.timeout(60_000),
    })
      .then((response) => response.ok)
      .catch(() => false));
    request.then((ok) => live && setStatus(ok ? "online" : "offline"));
    return () => {
      live = false;
    };
  }, []);

  return status;
}
