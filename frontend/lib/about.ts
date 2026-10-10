"use client";

import { useEffect, useState } from "react";

import { backendUrl } from "./backend";

/** What GET /about returns: the real models and settings behind the characters (no secrets). */
export type About = {
  embedder: { provider: string; model: string; dimensions: number };
  reranker: { provider: string; model: string };
  llm: { provider: string; model: string; max_tokens: number | null };
  chopper: {
    chunk_tokens: number;
    overlap_tokens: number;
    chars_per_token: number;
    max_text_chars: number;
  };
  translator: { max_weighted_words: number };
  scout: { candidates: number; rrf_k: number; max_private_chunks: number };
  judge: { keep: number };
  storyteller_prompt: string;
};

let cache: Promise<About> | null = null;

/** Clears the shared GET /about result (tests only). */
export function resetAboutCache() {
  cache = null;
}

/** GET /about once per page load, shared by everything that asks; null while loading or if it fails. */
export function useAbout(): About | null {
  const [about, setAbout] = useState<About | null>(null);

  useEffect(() => {
    let live = true;
    const request = (cache ??= fetch(`${backendUrl()}/about`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((body: About) => (body?.embedder ? body : Promise.reject("unexpected shape"))));
    request
      .then((result) => live && setAbout(result))
      .catch(() => {
        cache = null;
      });
    return () => {
      live = false;
    };
  }, []);

  return about;
}

/** The model's maker and name for display, for example "Google Gemini". */
export function llmName(about: About | null): string {
  const model = about?.llm.model ?? "";
  if (!model) return "…";
  if (model.startsWith("gemini")) return "Google Gemini";
  if (model.startsWith("claude")) return "Anthropic Claude";
  return model;
}
