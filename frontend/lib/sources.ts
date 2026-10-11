export type Source = { source: string; url?: string; licence: string; note?: string };

let cache: Promise<Record<string, Source>> | null = null;

/** Clears the cached sources (tests only). */
export function resetSourcesCache() {
  cache = null;
}

/** corpus/sources.json, fetched once and cached; an empty map on any error. */
export function loadSources(): Promise<Record<string, Source>> {
  cache ??= fetch("/corpus/sources.json")
    .then((response) => (response.ok ? response.json() : {}))
    .catch(() => ({}));
  return cache;
}
