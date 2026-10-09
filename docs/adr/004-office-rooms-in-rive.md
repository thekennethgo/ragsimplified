# ADR 004: Office rooms animated in Rive, one file per room

Status: Proposed (confirmed or replaced by the Rive spike, step 5.1)

## Context

The pages, rooms and characters were designed on the Claude Design canvas "Upload Page Workshop" (https://claude.ai/artifact/XkNNxKuaj5gfEvSfFhR15F). The art is kept apart from the page UI there: three rooms (the Upload office, the Ask office and the small Query room where the Clerk greets the visitor, plus a static break room on the Why RAG? page) and seven characters (Clerk, Chopper, Translator, Archivist, Scout, Judge, Storyteller), each in its own file.

`PLAN.md` and `docs/design/DESIGN_TO_CODE.md` planned a static SVG room with one Rive file per character placed over it. The scenes we now want need motion that crosses between characters:

- the Clerk leaves the Query room, walks into the Ask office, hands the question to the Translator and waits by the Storyteller;
- a card goes from the Chopper's bench to the Translator's in-tray;
- the Translator types, the printer prints, and the Translator walks to the stamping table to stamp the page.

Two things were tried on the canvas:

- **SVG animation (SMIL) in each character and room file.** The canvas editor did not play it. Each SVG also runs on its own clock, so a character and the prop it uses drift apart.
- **Separate canvases per character** (the current plan) cannot move a prop from one character to another, because each canvas has its own coordinate space.

Rive state machines wait in a state until code changes an input, and can send events back to code when an animation ends. That is what an event-driven scene needs.

## Decision

- **One `.riv` file per animated room, in `frontend/public/office/`:** `upload.riv`, `ask.riv` and `query.riv`. The break room on the Why RAG? page stays a static SVG.
- **Each room file has an artboard `Room`. Characters are nested artboards** inside it, so a character is built once per file and props move in one shared space. The Translator appears in `upload.riv` and `ask.riv`, and the Clerk in `ask.riv` and `query.riv`; each is copied into both files.
- **One state machine `main` per room, with:**
  - input `step` (number): the scene to show, from the table below;
  - input `nothing` (boolean): the "nothing found" ending;
  - event `sceneDone`, fired when the scene for the current `step` has finished playing.

  A number input is used instead of one trigger per step, so setting `step` always lands on the same scene, even after a reload or a fast response.

  | Room | `step` values |
  | --- | --- |
  | `upload.riv` | 0 idle, 1 Chopper cuts, 2 Translator types, prints and stamps, 3 Archivist files the cards, 4 done |
  | `ask.riv` | 0 idle (Clerk not in the room), 1 Clerk walks in and hands the question to the Translator, 2 Translator, 3 Scout, 4 Judge, 5 Storyteller (Clerk waits beside them), 6 done (Clerk leaves) |
  | `query.riv` | 0 Clerk at the counter, 1 Clerk away (door open), 2 Clerk back with the answer; with `nothing` on, step 2 shows the shrug |

- **Rive draws motion only. Real data never goes into a `.riv` file.** Speech bubbles, counts ("6 cards", "18 documents on file"), word weights, fingerprints, scores, the vector map and the answer are React overlays positioned over the canvas with the spot percentages in `frontend/lib/office-spots.ts`. This keeps to the brief's rule that every visual shows real data and that illustrations are labelled.
- **React drives the rooms.** The step events from `/upload` and `/ask` go through one reducer, which sets `step` and `nothing`. A queue moves to the next step when `sceneDone` arrives, but always shows each scene for at least 1 second and waits at most 4 seconds, so a broken or slow file never stalls the page.
- **Reduced motion and failure fallback.** With `prefers-reduced-motion`, or if a `.riv` file fails to load, the room shows the static SVG from step 5.0b and the step list from 5.11. The canvas has an `aria-label`; all live text stays in the DOM.
- **Source art comes from the design canvas, not Figma.** Claude writes flat, static SVGs of each room and character (with a named group for every part that moves) into `docs/design/rive-import/`. The owner imports them into Rive and animates there. Claude cannot edit `.riv` files.
- **Spike first.** Step 5.1 builds only the Upload room with the Chopper and Translator. If Rive's plan does not allow the export we need, or the SVG import does not work, this ADR is replaced by the fallback below before any more Rive work.

## Options considered and rejected

- **SVG with CSS or SMIL animation only.** No new tool, but timing across characters and travelling props must be hand-coded, each SVG keeps its own clock, and the canvas editor did not play SMIL. Kept as the fallback: static SVG rooms with named groups shown or hidden by CSS on each step, and no walking characters.
- **One `.riv` per character over a static room (the previous plan).** Simple per character, but props cannot travel between canvases and the Clerk cannot walk across the room.
- **The whole page in Rive.** Rive's text layout is not suited to variable data (lists of chunks, answers, scores), it is harder to make accessible, and it would break the "real data in the DOM" rule.
- **Lottie.** Plays linear timelines; waiting on events and branching would be rebuilt in code. Rive's state machine does it natively.

## Consequences

- **The owner does all animation in the Rive editor.** Claude prepares the import SVGs, the overlay positions and the code that plays the files.
- **PLAN.md Phase 5 changes:** the per-character Rive convention becomes this per-room one; the layout steps 5.0a to 5.0h follow the canvas look instead of the bright CSS office (no day/night switch, no Courier); the Figma steps and the per-character Rive steps are replaced by the SVG export (5.0b), the Rive spike (5.1), `OfficeRive` (5.2), the remaining scenes (5.3) and Rive on the Ask page (5.4); 5.8 and 5.9 become the data overlays on the Rive rooms. The cast is seven characters: the Collector (seed script only) and the Fact-Checker (step 4.3, skipped) have no character for now.
- **New frontend dependency:** `@rive-app/react-canvas`.
- **Copied characters.** The Translator and the Clerk each live in two `.riv` files; a change to one must be made in both.
- **A new pipeline step needs a new `step` number** in the room file and in the reducer's mapping. The tables above are the contract and must be kept in step with `frontend/lib/sceneState.ts`.
- **Unchecked limits.** Rive's current free-plan export limits and the file sizes of nested artboards are not checked yet; step 5.1 checks both. Aim for each room file under 500 KB.
