// Where each speech bubble sits over a room, in percent of the room box:
// left = (x - 150) / 10.6 and top = y / 6 for room coordinates x, y (the canvas's zoom).

export const UPLOAD_BUBBLES = {
  chopper: { left: 23.5, top: 42 }, // top-anchored (canvas Alt.dc.html)
  translator: { left: 41.5, bottom: 59.5 },
  archivist: { left: 77.4, bottom: 40.8 },
} as const;

export const ASK_BUBBLES = {
  translator: { left: 14.3, bottom: 50.8, tail: 74 },
  scout: { left: 37, bottom: 66.8, tail: 50 },
  judge: { left: 56.2, bottom: 53.2, tail: 50 },
  storyteller: { left: 68.8, bottom: 28.2, tail: 31 },
  clerk: { left: 44.1, bottom: 25.1 },
} as const;

// The "documents on file" number beside the plaque above the Upload office's file cabinets.
export const UPLOAD_DOC_COUNT = { left: 82.4, top: 38.5 } as const;
