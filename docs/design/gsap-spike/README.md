# GSAP spike: the Upload room

A throwaway test page, kept as the reference for ADR 004 and PLAN steps 5.0b and 5.1. Not
part of the app. It plays one full Upload cycle (Chopper, Translator, Archivist) on the
flat room SVG, driven by buttons that stand in for the backend's step events.

## Run it

```bash
cd docs/design/gsap-spike && python3 -m http.server 8765
```

Open http://127.0.0.1:8765/index.html. GSAP 3.12.5 loads from cdnjs.

- The six buttons are the events `chopper_start`, `chopper_done`, `translator_start`,
  `translator_done`, `archivist_start`, `archivist_done`. "Fire all 6 at once" checks the
  queue.
- "reduced motion" makes each scene jump to its end state (it starts from the OS setting).
- "show spots" shows the `spot-*` markers.

## Files

- `upload-room.svg`: the flat Upload room exported from `OfficeUpload.dc.html` on the
  design canvas, with a named group for every moving part.
- `translator.svgfrag`, `chars.svgfrag`: the Translator, Chopper and Archivist, copied by
  hand from `CharTranslator`, `CharChopper` and `CharArchivist` (`.dc.html`) without their
  SMIL animation, plus the props they carry (envelope, card, stamped page).
- `drawer.svgfrag`: a pulled-out cabinet drawer, drawn for the Archivist's scene (the
  exported cabinets draw their drawers as lines that cannot move).
- `template.html`: the page and all the animation code (scenes, queue, reduced motion).
- `build.py`: injects the room, drawer and characters into the template and writes
  `index.html`. Run `python3 build.py` here after editing any of the files above.
- `frames/`: key frames rendered from the timelines.

## What the spike showed

- Each event builds a short paused timeline for its scene. A scene can mark a `handoff`
  label: the next character's scene starts there while this one finishes (the Translator
  starts as soon as the card lands in the tray; the Archivist leaves after the third
  stamp). Scenes without one keep their end state for 1 second before the next starts.
- A start scene leaves a "still working" loop running for its character (chopping, the
  progress block pulsing, the folder held over the drawer) until that character's next
  event, so a scene lasts as long as the real backend step.
- Depth is the SVG's element order. Characters are drawn after the furniture. A prop that
  moves between furniture layers is moved in the DOM when it lands (the printout goes
  behind the stamp carousel). A walk that would pass behind furniture goes through a
  waypoint in front of it (the Archivist goes round the book cart).
- Jumping a timeline with `pause(t)` skips its `.call()` callbacks; use `seek(t, false)`.
- The in-tray sits behind the Translator's head, so the card hand-off is hard to see. The
  tray or the spot should move on the canvas.
