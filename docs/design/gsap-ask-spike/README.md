# GSAP spike: the Ask office and the Query room

A throwaway test page, kept as the reference for PLAN steps 5.0b, 5.2 and 5.3, like
`../gsap-spike/` is for the Upload room. Not part of the app. It plays one full Ask cycle on
the flat room SVGs, driven by buttons that stand in for the backend's step events.

## Run it

```bash
cd docs/design && python3 -m http.server 8765
```

Open http://127.0.0.1:8765/gsap-ask-spike/index.html (add `?play` to loop the whole cycle,
alternating a normal run and a "nothing found" run). GSAP 3.12.5 loads from cdnjs.

- "question sent" is `clerk_away` + `clerk_start`; then one button per step event;
  "answer done" is `clerk_done` + `clerk_back`. "judge done: nothing found" sends
  `judge_done` with nothing kept.
- "fire everything at once" checks the queue; "reduced motion" jumps each scene to its end.

## What it plays

- Query room: the Clerk takes the question, turns round and goes through the door; the
  "Back soon" card shows. At the end the Clerk comes back holding up the answer, or
  shrugging when nothing was found.
- Ask office: the Clerk comes in through the QUERY door and walks in one straight line
  behind the mobile whiteboard (it faces the crew, so we see its back) to its right end,
  writes the question with his hand and marker in view, and waits there. The Translator
  glances at the board and types; the slip goes to the Scout, who sweeps the lantern along
  the drawers and carries the pile to the Judge; the Judge goes over it with the magnifying
  glass, then hands the kept papers across the Storyteller's desk and files the rest; the
  Storyteller types; the Clerk walks over, takes the answer and leaves.
- Nothing found: the Judge is puzzled, walks over to the Clerk at the board ("No file found
  on this one."), and files the whole pile back.

## Files

- `ask-room-raw.svg`: the flat Ask office, exported from the canvas's `OfficeAsk.dc.html`
  (`../upload-page/project/`) with ids on the moving parts:
  `python3 tag-room.py ../upload-page/project/OfficeAsk.dc.html > OfficeAsk.tagged.dc.html`
  then `node export-room.js OfficeAsk.tagged.dc.html '{"phase":"idle"}' > ask-room-raw.svg`.
- `crew.svgfrag`: the Scout, Judge, Translator and Storyteller with the props they carry
  (`python3 build-crew.py`, from the canvas's `Char*.dc.html`).
- `office-extras.svgfrag`: the Clerk (back view, with the writing arm `cl-write`), the open
  door, the answer page, the hand-over papers, and the Judge's "?" and speech bubble.
- `query-room.svg`: the flat Query room from `RoomQuery.dc.html`, with the Clerk's front view.
- `template.html`: the page and all the animation code (scenes, walk spots, queue).
- `build.py`: puts it together into `index.html`; the whiteboard (`#qboard`) is drawn last so
  it covers whoever walks behind it.

## Geometry

Both offices use `viewBox="150 0 1060 600"` (the canvas's zoom). Walk spots in
`template.html` are SVG coordinates; the room coordinates they came from are in the comments.
The projection is `P(x, y, z) = [640 + 0.8(x - y), 210 + 0.4(x + y) - 0.8z]`.
