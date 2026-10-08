# Design to code: the office pages

## Context
The Upload, Ask and "Why RAG?" pages were designed on the Claude Design canvas
"Upload Page Workshop" (https://claude.ai/artifact/XkNNxKuaj5gfEvSfFhR15F), on branch
`design/upload-page`, files in `docs/design/upload-page/project/`. The 3D isometric
office was chosen. On the canvas the art is kept apart from the page UI:

- rooms: `OfficeUpload.dc.html`, `OfficeAsk.dc.html`, `RoomQuery.dc.html` (the small room
  where the Clerk greets the visitor on the Ask page) and `OfficeBreakRoom.dc.html`;
- characters: `CharClerk`, `CharChopper`, `CharTranslator`, `CharArchivist`, `CharScout`,
  `CharJudge` and `CharStoryteller` (`.dc.html`), each seen from behind facing its work
  (the Clerk also from the front);
- pages: `Alt.dc.html` (Upload), `AskAlt.dc.html` (Ask) and `WhyRag.dc.html`.

This plan takes the art into Rive for animation and the pages into the Next.js frontend,
wired to the existing step events. The decision behind it is ADR 004
(`docs/adr/004-office-rooms-in-rive.md`). The steps below are PLAN.md steps 5.0 to 5.4.

## Decisions
- **Ownership.** The canvas owns all page UI (header toggle, envelope form, Query panel,
  library panel, speech bubbles, sources sidebar, the Why RAG page) and the art. Rive owns
  the animation. React owns all real data. No part is edited in two places.
- **Rooms.** One `.riv` file per animated room in `frontend/public/office/`
  (`upload.riv`, `ask.riv`, `query.riv`), with the characters as nested artboards. The
  break room stays a static SVG. Each room's state machine `main` has inputs `step`
  (number) and `nothing` (boolean) and fires the event `sceneDone`; the `step` numbers are
  in ADR 004.
- **Real data stays in React.** Speech bubbles, counters, word weights, fingerprints,
  scores, the vector map and the answer are DOM overlays placed with
  `frontend/lib/office-spots.ts`. Nothing data-driven is drawn inside a `.riv` file.
- **Static fallback.** Each room also exists as a static SVG (from 5.0b). It is shown with
  `prefers-reduced-motion`, if a `.riv` file fails to load, and on the pages before Rive
  is wired in (5.0c to 5.0h).
- **Archivist.** No backend event. The frontend sets the Upload room's archivist step after
  `usePrivateTexts().add()`.
- **Remove.** Browser-only (deletes from `usePrivateTexts`). Part of the library panel, 5.0e.
- **Why RAG? page.** Short and snappy (5.0h): the break room, at most four short sections
  and a collapsible FAQ. The canvas version is a content source, not a layout to copy.
- **No Figma.** The art goes straight from the canvas to Rive as SVG. The old Figma steps
  (copy the scene into Figma, name layers, export) are replaced by step 2.

## Steps

1. **(You) 5.0 Final design and save it in git.**
   - Finish the pages, rooms and characters on the canvas.
   - Pull every canvas file into `docs/design/upload-page/project/` and commit it on
     `design/upload-page`; open a PR for review.

2. **5.0b Office art files** (one PR).
   - Render each room and character from its canvas file into a flat, static SVG (the
     geometry is computed by the file's script, so write a small Node script in the
     scratch area that runs it and fills in the values; do not commit the script).
   - Write them to `docs/design/rive-import/`: `upload-room.svg`, `ask-room.svg`,
     `query-room.svg`, `break-room.svg`, and `char-<name>-back.svg` /
     `char-clerk-front.svg`.
   - Give every moving part its own group with a kebab-case id, for example:
     - Upload room: `card-pile`, `in-card`, `crt-lines`, `printer`, `printout`,
       `stamp-mark`, `stamp-table`, `cabinet-plaque`.
     - Ask room: `lantern-beam`, `lit-drawers`, `kept-papers`, `answer-dots`,
       `printout`, `crt-lines`.
     - Query room: `query-door-shut`, `query-door-open`, `back-soon-card`.
     - Characters: `arm-left`, `arm-right`, `tool` and the pose groups.
   - Mark each character spot with a `spot-<name>` group, and write the spots as
     percentages of the room's width and height into `frontend/lib/office-spots.ts`:

     export const UPLOAD_SPOTS = {
       chopper: { left: 29.4, top: 53 },
       translator: { left: 48.8, top: 40.3 },
       archivist: { left: 78.1, top: 59 },
     } as const;

3. **(You) 5.1 Rive spike: Upload room.**
   - Import `upload-room.svg`, `char-chopper-back.svg` and `char-translator-back.svg`.
   - Make the two characters nested artboards; build `main` with `step`, `nothing` and
     `sceneDone`; animate steps 0 to 2.
   - Check the export works on Rive's current plan and note the file size.
   - If it fails, replace ADR 004 with its fallback (static SVG rooms, CSS show/hide of
     the named groups) and rewrite steps 5.2 to 5.4 before going on.

4. **5.0c to 5.0e Static port: Upload page** (one PR per step: office scene, envelope,
   library panel).
   - Add `frontend/components/office/OfficeScene.tsx`. It renders a room's static SVG
     from 5.0b and takes
     `props: { states: Record<string, "waiting" | "working" | "done" | "error">, data }`.
   - Add `frontend/components/office/SpeechBubble.tsx`, positioned by `office-spots.ts`.
   - Add `frontend/components/upload/EnvelopeForm.tsx` and
     `frontend/components/LibraryPanel.tsx` (Documents / Vector map toggle; the map part
     uses the 5.0g component when it exists, otherwise a placeholder).
   - Rewrite `frontend/app/upload/page.tsx` to use these components. Keep the existing
     fetch to `/upload`, `readEvents()` from `frontend/lib/backend.ts`, `usePrivateTexts`
     and the `GET /library` call.
   - Map events to state in one reducer, `frontend/lib/sceneState.ts`:

     type Phase = "waiting" | "working" | "done" | "error";
     export function sceneReducer(s: Record<string, Phase>, e: StepEvent) {
       if (e.step === "error") return { ...s, error: "done" };
       return { ...s, [e.step]: e.status === "start" ? "working" : "done" };
     }

   - Port styles into CSS modules next to each component (the frontend has no Tailwind).
     Copy colours and spacing from `Alt.dc.html`.
   - Out of scope: Rive, animations.

5. **5.0f Static port: Ask page** (one PR). Re-skin the
   components in `frontend/components/ask/` (`CharacterRow`, `QuestionBubble`,
   `AnswerBubble`, `SourcesSidebar`) with `AskAlt.dc.html`: the Query panel with
   `query-room.svg` and the Clerk's speech bubble, and `OfficeScene` with `ask-room.svg`.
   Keep all existing Ask behaviour and tests.

6. **5.2 OfficeRive** (one PR).
   - Add the Rive convention from PLAN.md to `CLAUDE.md`.
   - Add `@rive-app/react-canvas` to `frontend/package.json`.
   - Create `frontend/components/office/OfficeRive.tsx`: plays one room file, sets `step`
     and `nothing` from `sceneReducer`'s state, and listens for the `sceneDone` event.
   - Add a queue in front of it: the next step starts when `sceneDone` arrives, after at
     least 1 second and at most 4 seconds.
   - Show `OfficeScene` (the static SVG) instead when `prefers-reduced-motion` is set or
     the `.riv` file fails to load.
   - Wire `upload.riv` into the Upload page; the overlays from step 4 stay on top.

7. **(You) 5.3 Rive: the remaining scenes.** Finish `upload.riv`, and build `ask.riv` and
   `query.riv` with every `step` value from ADR 004.

8. **5.4 Rive on the Ask page** (one PR). Play `query.riv` and `ask.riv` with
   `OfficeRive`, both driven by the same reducer, so the Clerk leaves the Query room as it
   enters the office and comes back with the answer.

## Coming back in a new session
- Say "update my Upload Page Workshop design" or paste the artifact link. Claude reads the
  latest version, including hand edits, and works from it.
- After any canvas change, pull the files into `docs/design/upload-page/project/` and
  commit, so git matches the canvas.
- After any art change that Rive needs, re-run step 2 for that room or character and
  re-import it in Rive. Keep the group ids the same; the code only changes when a `step`
  number or a spot is added or renamed.

## Verification
- After each code step: `make lint` and `make test` pass.
- Step 2: each SVG in `docs/design/rive-import/` opens in a browser and matches its canvas
  artboard; the group ids listed above exist (`grep 'id="printer"'` and so on).
- Step 4: paste a text on the Vercel preview URL. The Chopper and Translator bubbles go
  Waiting → Working → Done in order; the card pile shows the real chunk count; the text
  appears under "Your books"; `curl` against `/upload` shows the same events.
- Step 5: a question on the preview URL shows the Clerk's greeting, the question words
  highlighted, the character states, the answer and the sources sidebar. Existing Ask
  tests still pass.
- Step 6: one real upload plays idle, Chopper and Translator in order; with reduced motion
  on, the static room shows instead; with network throttling on, no scene is skipped.
- Step 8: a good question and an unanswerable one both play correctly, and the Clerk is
  never in both rooms at once.
