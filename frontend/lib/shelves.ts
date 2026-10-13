export type Shelf = { id: string; name: string; questions: string[]; color: string };

/** The colour of shelves the list below does not know, and of the "other" shelf. */
export const OTHER_COLOR = "#8A7A6A";

/** The library's shelves in display order: one per folder of `corpus/`. */
export const SHELVES: Shelf[] = [
  {
    id: "about-kenneth",
    name: "About the creator",
    questions: [
      "What is Kenneth's academic background?",
      "What project is Kenneth most proud of?",
    ],
    color: "#4e79a7",
  },
  {
    id: "this-project",
    name: "This project",
    questions: [
      "Why does the Judge sometimes take a second look?",
      "Is my pasted text stored anywhere?",
    ],
    color: "#f28e2b",
  },
  {
    id: "rag-basics",
    name: "RAG basics",
    questions: ["What is retrieval-augmented generation?", "What is a vector database?"],
    color: "#e15759",
  },
  {
    id: "how-ai-works",
    name: "How AI works",
    questions: ["Why do language models hallucinate?", "How does a transformer work?"],
    color: "#59a14f",
  },
  {
    id: "ai-history",
    name: "AI history",
    questions: ["Where did the term artificial intelligence come from?", "What started the AI boom?"],
    color: "#b07aa1",
  },
  {
    id: "ai-and-society",
    name: "AI and society",
    questions: ["How could AI affect jobs?", "What is algorithmic bias?"],
    color: "#9c755f",
  },
  {
    id: "lore",
    name: "RAG.co lore (fictional)",
    questions: [
      "What does the RAG.co staff handbook say about lunch breaks?",
      "What is the no-guessing guarantee in the Query Desk terms?",
    ],
    color: "#d37295",
  },
  {
    id: "places-and-interests",
    name: "Places & interests",
    questions: ["What are some of Kenneth's hobbies?", "What is Kenneth's hometown known for?"],
    color: "#b6992d",
  },
  {
    id: "movies-and-games",
    name: "Movies & games",
    questions: ["What are Kenneth's favourite movies about?", "What are Kenneth's favourite video games?"],
    color: "#499894",
  },
  {
    id: "general",
    name: "General",
    questions: ["Which chess champion lost to Deep Blue?", "Which mission first landed humans on the Moon?"],
    color: "#34495e",
  },
];

/** The shelf id of a library filename: its first folder, or "other". */
export function shelfOf(filename: string): string {
  const slash = filename.indexOf("/");
  return slash === -1 ? "other" : filename.slice(0, slash);
}

/** The shelf for an id: a listed one, or a made-up one named after the folder. */
export function shelfFor(id: string): Shelf {
  const known = SHELVES.find((shelf) => shelf.id === id);
  if (known) return known;
  const words = id === "other" ? "other" : id.replace(/-/g, " ");
  return {
    id,
    name: words.charAt(0).toUpperCase() + words.slice(1),
    questions: [],
    color: OTHER_COLOR,
  };
}

/** Documents grouped by shelf, in SHELVES order, then unknown shelves A to Z, then "other". */
export function groupByShelf<T extends { filename: string }>(
  docs: T[],
): { shelf: Shelf; docs: T[] }[] {
  const byShelf = new Map<string, T[]>();
  for (const doc of docs) {
    const id = shelfOf(doc.filename);
    byShelf.set(id, [...(byShelf.get(id) ?? []), doc]);
  }
  const known = SHELVES.map((shelf) => shelf.id);
  const unknown = [...byShelf.keys()]
    .filter((id) => id !== "other" && !known.includes(id))
    .sort((a, b) => a.localeCompare(b));
  return [...known, ...unknown, "other"]
    .filter((id) => byShelf.has(id))
    .map((id) => ({ shelf: shelfFor(id), docs: byShelf.get(id)! }));
}
