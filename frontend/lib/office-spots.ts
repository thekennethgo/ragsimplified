// Fixed spots over a room, in percent of the room box (speech bubbles follow their characters instead).

// The "documents on file" number beside the plaque above the Upload office's file cabinets.
export const UPLOAD_DOC_COUNT = { left: 82.4, top: 38.5 } as const;

// The same number beside the plaque above the Ask office's shelves. Derived from the removed art text at (464.6, 139.1) in the
// room's viewBox "150 0 1060 600": left = (464.6 - 150) / 1060, top = (139.1 + 3.2 - 16) / 600 (baseline, 0.2em below it
// for the bottom of the box, one 16-unit em up for its top).
export const ASK_DOC_COUNT = { left: 29.7, top: 21.0 } as const;
