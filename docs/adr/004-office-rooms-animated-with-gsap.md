# ADR 004: Office rooms animated in code with GSAP

Status: Accepted (2026-10-09, after the GSAP spike in `docs/design/gsap-spike/`). Replaces the earlier proposal under this number, "Office rooms animated in Rive, one file per room", which was never built.

## Context

The pages, rooms and characters were designed on the Claude Design canvas "Upload Page Workshop" (https://claude.ai/artifact/XkNNxKuaj5gfEvSfFhR15F). The art is kept apart from the page UI there: three animated rooms (the Upload office, the Ask office and the small Query room where the Clerk greets the visitor), a static break room on the Why RAG? page, and seven characters (Clerk, Chopper, Translator, Archivist, Scout, Judge, Storyteller), each in its own file.

The scenes need motion that crosses between characters and waits for the backend: a card goes from the Chopper's bench to the Translator's in-tray; the Translator types, prints and walks to the stamping table; the Archivist takes the stamped page and files it; on the Ask page the Clerk carries the question in and waits by the Storyteller. Each scene must wait for the real step event, and must last as long as the real step does.

The first version of this ADR chose Rive: one `.riv` file per room, a state machine with a `step` input, and the owner animating in the Rive editor. Two problems with that:

- **Claude cannot edit `.riv` files.** Every timing, pose or art change would go through the owner in the Rive editor, and the owner would have to re-import the art after every canvas change.
- **The project is a data-driven visualisation.** The brief wants the visuals to show real data: the real number of chunks, cuts at the real chunk boundaries, fingerprints from real vectors, real ranks. A `.riv` file can only switch between scenes drawn in advance; it cannot draw one card per real chunk.

A spike (`docs/design/gsap-spike/`) built the whole Upload cycle with GSAP on the flat Upload room SVG: the Chopper takes the mail from the inbox, cuts it and carries a card to the in-tray; the Translator types, prints, walks to the stamping table and stamps three times; the Archivist takes the page and files it in a cabinet drawer. Six buttons stood in for the step events. The queue, the "still working" loops, the handoffs between characters and reduced motion all worked, and Claude built and changed every part of it.

## Decision

- **Rooms are inline SVG animated with GSAP.** Add `gsap` 3.15.0 and `@gsap/react` 2.1.2, pinned to exact versions. GSAP's core is enough; no plugins are needed. GSAP is free for any use, including commercial, since version 3.13.
- **One SVG per room, with its characters in it.** `frontend/public/office/upload-room.svg`, `ask-room.svg` and `query-room.svg`, plus the static `break-room.svg`. Each animated room file holds the room art, its characters standing at their spots, the props they carry, and any extra moving parts the scenes need (for example a cabinet drawer that slides out). A character that appears in two rooms is copied into both: the Translator in the Upload and Ask rooms, the Clerk in the Ask and Query rooms.
- **Id rules in the room SVGs.** These ids are the contract between the art and the scene code.
  - Room parts that move have kebab-case ids: `in-card`, `printer`, `printout`, `cabinet-drawer`.
  - Each character is a group named after it (`chopper`, `translator`), drawn in an 80 by 120 box with its feet at (40, 116). Inside it, a group `<p>-flip` turns the character to face left or right. `<p>` is a two-letter prefix used on every part of that character: `cl` Clerk, `ch` Chopper, `tr` Translator, `ar` Archivist, `sc` Scout, `ju` Judge, `st` Storyteller. Examples: `tr-stamp-arm`, `ch-held-card`, `ar-check`.
  - A character's home position is a `spot-<name>` marker. Every other place it walks to is a `spot-<name>-<place>` marker, for example `spot-chopper-inbox` or `spot-archivist-around` (a waypoint). The code reads walk targets from these markers and hides them, so moving a marker in the art moves the walk.
- **Depth is the SVG's element order.** Characters come after the furniture. A carried item is a prop inside the character's group, shown and hidden as needed. A prop that moves between furniture layers is moved in the DOM when it lands; it keeps the same coordinates. A walk that would pass behind furniture goes through a waypoint in front of it.
- **Scenes are code, one module per room.** `frontend/lib/office/scenes/upload.ts`, `ask.ts` and `query.ts` each export a map from a scene key `<step>_<status>` (for example `chopper_start`) to a function that builds that scene as a paused GSAP timeline. A scene may have a label `handoff`. A `start` scene may leave a "still working" loop running for its character; that character's next scene stops it.

  | Room | Scene keys |
  | --- | --- |
  | Upload | `chopper_start`, `chopper_done`, `translator_start`, `translator_done`, `archivist_start`, `archivist_done` |
  | Ask | `clerk_start` (Clerk walks in and hands over the question), `translator_*`, `scout_*`, `judge_*`, `storyteller_*`, `clerk_done` (Clerk leaves) |
  | Query | `clerk_away` (door open, "Back soon"), `clerk_back` (Clerk returns with the answer), `clerk_shrug` (nothing found) |

  - **From the backend:** `chopper`, `translator`, `scout`, `judge` and `storyteller`, each with `start` and `done`.
  - **Made by the frontend:**
    - The Archivist has no backend step: `archivist_start` and `archivist_done` are sent around `usePrivateTexts().add()`.
    - The Clerk's events follow the question being sent and the answer being done.
  - **Nothing found:** when the Judge's `done` event keeps no results, the "nothing found" scenes play: `judge_done`, `storyteller_*` and `clerk_shrug`.
- **One queue plays the scenes.** `frontend/lib/office/sceneQueue.ts` is plain TypeScript with no React, so it can be tested on its own.
  - It plays one scene at a time, in event order.
  - The next scene starts at the current scene's `handoff` label if it has one. Otherwise it starts when the current scene ends, plus 1 second.
  - Events with no scene are ignored.
  - An `error` event clears the queue and stops every loop. The speech bubbles show the error.

  `frontend/components/office/OfficeRoom.tsx` loads a room SVG from `/office/` into the page (a static file we ship), scopes GSAP to it with `useGSAP`, and feeds the queue from the reducer in `frontend/lib/sceneState.ts`.
- **Reduced motion.** With `prefers-reduced-motion`, every scene jumps to its end state, still at least 1 second apart, and no loops run. The step list from 5.11 is shown as well. If the SVG fails to load, the page still works with the speech bubbles and the step list.
- **Real data.**
  - **Text stays in the DOM:** speech bubbles, counts, word weights, scores and the answer are React overlays placed with `frontend/lib/office-spots.ts`, so they stay readable and accessible.
  - **Drawn from real data:** shapes in the room may be drawn or placed by code from the real data. Examples: one card per real chunk, cuts at the real chunk boundaries, a fingerprint from the first 32 numbers of a real vector. These shapes are `aria-hidden`, and the same information is in the DOM.
- **Art comes from the design canvas.** Claude exports flat SVGs from the canvas files (step 5.0b) and keeps the ids above. Claude writes the scenes. The owner reviews them in the browser on the PR's preview URL.

## Options considered and rejected

- **Rive, one file per room (the first version of this ADR).** Claude cannot edit `.riv` files, so every change goes through the owner. The scenes cannot be drawn from real data. It also needs a check of Rive's export limits and a canvas-based runtime.
- **SVG with CSS or SMIL animation only.** No new dependency, but there is no timeline to wait on, label or nest. Long scenes across several characters would be hand-timed delays. Each SMIL animation runs on its own clock, and the canvas editor did not play SMIL.
- **Lottie.** It plays fixed timelines drawn in advance, with no waiting on events and no data.
- **Motion (Framer Motion) or the Web Animations API.** Both are fine for UI transitions. For long multi-character scenes with labels, handoffs and nesting, we would rebuild what GSAP's timeline already does.
- **A canvas or game engine (for example PixiJS).** It loses the SVG art as authored on the canvas, the DOM ids that tie art to code, and easy accessibility.

## Consequences

- **New frontend dependencies:** `gsap` and `@gsap/react`, which add GSAP's core to the pages that show a room.
- **Claude does the animation.** The owner's part is reviewing on the preview URL and changing the art on the canvas. No separate animation tool or file format.
- **The ids are a contract.** An art change must keep the ids the scenes use, or the scenes change in the same PR. A test checks that every id a room's scenes use exists in that room's SVG.
- **Copied characters.** The Translator and the Clerk each live in two room files. A change to one must be made in both.
- **Walk targets and depth are hand-planned per room.** Each room needs its `spot-<name>-<place>` markers, and a written note in its scene module of which props change layer.
- **Visual checks stay manual.** jsdom cannot lay out SVG, so tests cover the queue, the scene keys and the ids. How the scenes look is checked in the browser.
- **PLAN.md Phase 5 changes:**
  - The Rive convention becomes the convention above.
  - 5.0b writes the room SVGs with their characters, props and walk markers, starting from the spike.
  - The Rive steps 5.1 to 5.4 become code steps: 5.1 the room player and the Upload scenes, 5.2 the Ask room scenes, 5.3 the Query room scenes, 5.4 both rooms on the Ask page.
  - 5.8 and 5.9 add the data-driven parts to these scenes.
  - The cast stays seven characters: the Collector (seed script only) and the Fact-Checker (step 4.3, skipped) have no character.
