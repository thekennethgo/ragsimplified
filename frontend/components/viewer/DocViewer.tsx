"use client";

import type { ViewTarget } from "../../lib/viewer";
import LibraryDocView from "./LibraryDocView";
import PrivateTextView from "./PrivateTextView";

/** The document for a ViewTarget; it remounts on each new target so the cited chunk scrolls in. */
export default function DocViewer({ target }: { target: ViewTarget }) {
  return target.kind === "library" ? (
    <LibraryDocView
      key={JSON.stringify(target)}
      id={target.id}
      chunk={target.chunk}
      scrollBlock="nearest"
    />
  ) : (
    <PrivateTextView
      key={JSON.stringify(target)}
      index={target.index}
      chunk={target.chunk}
      scrollBlock="nearest"
    />
  );
}
