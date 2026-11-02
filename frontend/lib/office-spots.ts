// Fixed spots over a room, in percent of the room box (speech bubbles follow their characters instead).

// The "documents on file" number beside the plaque above the Upload office's file cabinets.
export const UPLOAD_DOC_COUNT = { left: 78.9, top: 34.7 } as const;

// The same number beside the plaque above the Ask office's shelves. Derived from the removed art text at (464.6, 139.1) in the
// room's viewBox "280 60 750 545": left = (464.6 - 280) / 750, top = (139.1 + 3.2 - 16 - 60) / 545 (baseline, 0.2em below it
// for the bottom of the box, one 16-unit em up for its top, less the viewBox's top edge).
export const ASK_DOC_COUNT = { left: 24.6, top: 12.2 } as const;
