"use client";

import { type ReactNode, createContext, useContext, useState } from "react";

export type PrivateText = {
  title: string;
  text: string;
  chunks: { position: number; heading: string | null; text: string }[];
  vectors: number[][];
  /** Each chunk's place on the vector map (missing when the backend has no map). */
  points?: { x: number; y: number }[];
};

type PrivateTexts = {
  texts: PrivateText[];
  add: (text: PrivateText) => void;
  remove: (index: number) => void;
};

const PrivateTextsContext = createContext<PrivateTexts | null>(null);

/**
 * Holds the visitor's private texts, chunks and vectors in memory (ADR 002).
 * Nothing is stored: they are lost when the tab is closed or refreshed.
 */
export function PrivateTextsProvider({ children }: { children: ReactNode }) {
  const [texts, setTexts] = useState<PrivateText[]>([]);
  const add = (text: PrivateText) => setTexts((items) => [...items, text]);
  const remove = (index: number) => setTexts((items) => items.filter((_, i) => i !== index));
  return (
    <PrivateTextsContext.Provider value={{ texts, add, remove }}>
      {children}
    </PrivateTextsContext.Provider>
  );
}

export function usePrivateTexts(): PrivateTexts {
  const value = useContext(PrivateTextsContext);
  if (!value) throw new Error("usePrivateTexts must be used inside PrivateTextsProvider");
  return value;
}
