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

This plan takes the art into the Next.js frontend as SVG, animates the rooms in code with
GSAP, and wires them to the existing step events. The decision behind it is ADR 004
(`docs/adr/004-office-rooms-animated-with-gsap.md`), based on the spike in
`docs/design/gsap-spike/`. The steps below are PLAN.md steps 5.0 to 5.4.

## Decisions
- **Ownership.** The canvas owns all page UI (header toggle, envelope form, Query panel,
  library panel, speech bubbles, sources sidebar, the Why RAG page) and the art. The scene
  modules in `frontend/lib/office/scenes/` own the animation. React owns all real data.
  No part is edited in two places.
- **Rooms.** One SVG per room in `frontend/public/office/` (`upload-room.svg`,
  `ask-room.svg`, `query-room.svg`, and the static `break-room.svg`), with its characters,
  carried props and extra moving parts in it, named by the id rules in ADR 004. GSAP
  animates them; the scene keys (`chopper_start`, `translator_done` and so on) are in
  ADR 004.
- **Real data.** Speech bubbles, counters, word weights, scores and the answer are DOM
  overlays placed with `frontend/lib/office-spots.ts`. Shapes drawn from real data (one
  card per chunk, fingerprints) may be added to the room SVG by the scene code; they are
  `aria-hidden` and the same information is in the DOM.
- **Reduced motion.** Each scene jumps to its end state, at least 1 second apart. The rooms
  are the same SVGs on the pages before animation is added (5.0c to 5.0h).
- **Archivist.** No backend event. The frontend sends `archivist_start` and
  `archivist_done` around `usePrivateTexts().add()`.
- **Remove.** Browser-only (deletes from `usePrivateTexts`). Part of the library panel, 5.0e.
- **Why RAG? page.** Short and snappy (5.0h): the break room, at most four short sections
  and a collapsible FAQ. The canvas version is a content source, not a layout to copy.
- **No Figma, no Rive.** The art goes straight from the canvas to SVG in the frontend.
  The old Figma steps and the Rive steps are replaced by steps 2, 3, 6 and 7.

## Steps

1. **(You) 5.0 Final design and save it in git.**
   - Finish the pages, rooms and characters on the canvas.
   - Pull every canvas file into `docs/design/upload-page/project/` and commit it on
     `design/upload-page`; open a PR for review.

2. **5.0b Office art files** (one PR).
   - Render each room from its canvas file into a flat, static SVG (the geometry is
     computed by the file's script, so write a small Node script in the scratch area that
     runs it and fills in the values; do not commit the script).
   - Write them to `docs/design/office-svg/` and copy them to `frontend/public/office/`:
     `upload-room.svg`, `ask-room.svg`, `query-room.svg`, `break-room.svg`.
   - Start the Upload room from `docs/design/gsap-spike/`: `upload-room.svg` plus the
     drawer and character fragments that its `build.py` puts in.
   - Put each room's characters in its SVG at their spots, with the props they carry,
     following the id rules in ADR 004, for example:
     - Upload room: `in-card`, `envelope`, `cutter-blade`, `cut-cards`, `crt-lines`,
       `crt-progress`, `printer`, `printout`, `stamp-mark`, `cabinet-drawer`; characters
       `chopper`, `translator`, `archivist` with `ch-*`, `tr-*`, `ar-*` parts.
     - Ask room: `lantern-beam`, `lit-drawers`, `kept-papers`, `answer-dots`, `printout`,
       `crt-lines`.
     - Query room: `query-door-shut`, `query-door-open`, `back-soon-card`.
   - Mark each home spot with `spot-<name>` and every walk target or waypoint with
     `spot-<name>-<place>`, and write the home spots as percentages of the room's width
     and height into `frontend/lib/office-spots.ts`:

     export const UPLOAD_SPOTS = {
       chopper: { left: 32.5, top: 72.3 },
       translator: { left: 51.9, top: 59.7 },
       archivist: { left: 81.3, top: 78.3 },
     } as const;

3. **Done: the GSAP spike.** `docs/design/gsap-spike/` plays the whole Upload cycle on
   `upload-room.svg` from buttons. It replaced the Rive spike (old step 5.1).

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
   - Out of scope: animation.

5. **5.0f Static port: Ask page** (one PR). Re-skin the
   components in `frontend/components/ask/` (`CharacterRow`, `QuestionBubble`,
   `AnswerBubble`, `SourcesSidebar`) with `AskAlt.dc.html`: the Query panel with
   `query-room.svg` and the Clerk's speech bubble, and `OfficeScene` with `ask-room.svg`.
   Keep all existing Ask behaviour and tests.

6. **5.1 Room player and Upload scenes** (one PR).
   - Add the office animation convention from PLAN.md to `CLAUDE.md`.
   - Add `gsap` and `@gsap/react` to `frontend/package.json` at the exact versions in
     ADR 004.
   - Create `frontend/lib/office/sceneQueue.ts` (plays one scene at a time; next scene at
     the `handoff` label or 1 second after the end; per-character "still working" loops;
     `error` clears it; reduced motion jumps to end states) with tests using fake
     timelines.
   - Create `frontend/components/office/OfficeRoom.tsx`: loads a room SVG from `/office/`,
     hides the `spot-*` markers, scopes GSAP with `useGSAP`, feeds the queue from
     `sceneReducer`'s events.
   - Port the spike's scenes to `frontend/lib/office/scenes/upload.ts` and show
     `upload-room.svg` on the Upload page; the overlays from step 4 stay on top.

7. **5.2 and 5.3 Ask and Query room scenes** (one PR each). `scenes/ask.ts` and
   `scenes/query.ts` with every scene key in ADR 004, played from buttons on the dev-only
   page `frontend/app/dev/office/page.tsx`.

8. **5.4 Animation on the Ask page** (one PR). Show `query-room.svg` and `ask-room.svg`
   with `OfficeRoom`, both driven by the same reducer, so the Clerk leaves the Query room
   as it enters the office and comes back with the answer.

## Coming back in a new session
- Say "update my Upload Page Workshop design" or paste the artifact link. Claude reads the
  latest version, including hand edits, and works from it.
- After any canvas change, pull the files into `docs/design/upload-page/project/` and
  commit, so git matches the canvas.
- After any art change, re-run step 2 for that room. Keep the ids the same; the scene code
  only changes when an id, a spot or a scene key is added or renamed. Remember the
  Translator and the Clerk are each copied into two rooms.

## Verification
- After each code step: `make lint` and `make test` pass.
- Step 2: each SVG in `docs/design/office-svg/` opens in a browser and matches its canvas
  artboard; the ids listed above exist (`grep 'id="printer"'` and so on).
- Step 4: paste a text on the Vercel preview URL. The Chopper and Translator bubbles go
  Waiting → Working → Done in order; the card pile shows the real chunk count; the text
  appears under "Your books"; `curl` against `/upload` shows the same events.
- Step 5: a question on the preview URL shows the Clerk's greeting, the question words
  highlighted, the character states, the answer and the sources sidebar. Existing Ask
  tests still pass.
- Step 6: one real upload plays the mail arriving, the Chopper, the Translator and the
  Archivist in order, with the handoffs; with reduced motion on, each scene jumps to its
  end state; with network throttling on, no scene is skipped.
- Step 7: the dev page plays every Ask and Query scene key, including "nothing found".
- Step 8: a good question and an unanswerable one both play correctly, and the Clerk is
  never in both rooms at once.
