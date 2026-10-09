# Design to code: the office pages

## Context
The home page and the Upload and Ask pages were designed on the Claude Design canvas
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
`docs/design/gsap-spike/`; the Ask office and Query room scenes were tested the same way in
`docs/design/gsap-ask-spike/`. The steps below are PLAN.md steps 5.0 and 5.1.

## Decisions
- **Ownership.** The canvas owns all page UI (header toggle, envelope form, Query panel,
  library panel, speech bubbles, sources sidebar, the home page) and the art. The scene
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
  are the same SVGs either way.
- **Archivist.** No backend event. The frontend sends `archivist_start` and
  `archivist_done` around `usePrivateTexts().add()`.
- **Remove.** Browser-only (deletes from `usePrivateTexts`). Part of the library panel.
- **Home page.** `/` is the canvas's `WhyRag.dc.html`: a hero, the break room,
  "What is RAG?", "Why not just ask the model?", "How this one is built" and "About the
  creator", with nothing said twice. The header tabs are "Home | Upload | Ask".
- **No Figma, no Rive.** The art goes straight from the canvas to SVG in the frontend.
  The old Figma steps and the Rive steps are replaced by step 5.1.

## Steps

1. **(You) 5.0 Final design and save it in git.** Pull every canvas file into
   `docs/design/upload-page/project/` and commit it with the two spikes.

2. **5.1 Office pages and animation** (one PR). In this order inside the branch:
   1. **Room art.** `docs/design/office-svg/` and `frontend/public/office/`:
      `upload-room.svg` from `docs/design/gsap-spike/` (`upload-room.svg` plus the drawer and
      character fragments its `build.py` puts in), `ask-room.svg` and `query-room.svg` from
      `docs/design/gsap-ask-spike/` (its `build.py` output, without the page), and
      `break-room.svg` from `OfficeBreakRoom.dc.html` (render it with a small Node script in
      the scratch area that runs the file's script and fills in the values, like the spikes'
      `export-room.js`; do not commit the script). Keep every id the spikes' scenes use and
      add the `spot-*` markers. Home spots go into `frontend/lib/office-spots.ts`:

          export const UPLOAD_SPOTS = {
            chopper: { left: 25.1, top: 72.3 },
            translator: { left: 48.5, top: 59.7 },
            archivist: { left: 84, top: 78.3 },
          } as const;

      The rooms are drawn on a 1280 x 600 grid but shown through `viewBox="150 0 1060 600"`
      (the canvas's zoom), so `left = (x - 150) / 10.6` and `top = y / 6`.
   2. **Look and tabs.** Fonts, tokens and the "Home | Upload | Ask" header tabs.
   3. **Player.** Add the office animation convention from PLAN.md to `CLAUDE.md`; add
      `gsap` and `@gsap/react` at the exact versions in ADR 004;
      `frontend/lib/office/sceneQueue.ts` (one scene at a time; next at the `handoff` label
      or 1 second after the end; per-character "still working" loops; `error` clears it;
      reduced motion jumps to end states) with tests using fake timelines;
      `frontend/components/office/OfficeRoom.tsx` (loads a room SVG from `/office/`, hides
      the `spot-*` markers, scopes GSAP with `useGSAP`); one reducer in
      `frontend/lib/sceneState.ts` that turns the step events into scene events and bubble
      states:

          type Phase = "waiting" | "working" | "done" | "error";
          export function sceneReducer(s: Record<string, Phase>, e: StepEvent) {
            if (e.step === "error") return { ...s, error: "done" };
            return { ...s, [e.step]: e.status === "start" ? "working" : "done" };
          }

   4. **Scenes.** Port `template.html` of each spike to `frontend/lib/office/scenes/`:
      `upload.ts`, `ask.ts`, `query.ts` (the Query scenes `clerk_back` and `clerk_shrug` are
      one scene in the spike, split by its `nothingFound` flag). Walk targets come from the
      spot markers. A test checks every id a scene file uses exists in its room SVG.
   5. **Upload page.** `frontend/components/office/SpeechBubble.tsx` (placed with
      `office-spots.ts`), `frontend/components/upload/EnvelopeForm.tsx` and
      `frontend/components/LibraryPanel.tsx` (Documents / Map; Map is a placeholder until
      5.0g). Rewrite `frontend/app/upload/page.tsx` with them and `OfficeRoom`, keeping the
      fetch to `/upload`, `readEvents()` from `frontend/lib/backend.ts`, `usePrivateTexts`
      and the `GET /library` call.
   6. **Ask page.** Re-skin `frontend/components/ask/` (`QuestionBubble`, `AnswerBubble`,
      `SourcesSidebar`) with `AskAlt.dc.html`; the Query panel with `query-room.svg` and the
      Clerk's bubble, and the Ask office with `OfficeRoom` replacing `CharacterRow`. Send the
      Clerk's events around the question (`clerk_away` + `clerk_start` on send; `clerk_done`
      then `clerk_back` or `clerk_shrug` on the answer). Keep all existing Ask behaviour.
   7. **Home page.** `frontend/app/page.tsx` from `WhyRag.dc.html` with `break-room.svg`.

   Port styles into CSS modules next to each component (the frontend has no Tailwind);
   copy colours and spacing from `Alt.dc.html` and `AskAlt.dc.html`.

## Coming back in a new session
- Say "update my Upload Page Workshop design" or paste the artifact link. Claude reads the
  latest version, including hand edits, and works from it.
- After any canvas change, pull the files into `docs/design/upload-page/project/` and
  commit, so git matches the canvas.
- After any art change, re-run step 2 for that room. Keep the ids the same; the scene code
  only changes when an id, a spot or a scene key is added or renamed. Remember the
  Translator and the Clerk are each copied into two rooms.

## Verification
- `make lint` and `make test` pass.
- Room art: each SVG in `docs/design/office-svg/` opens in a browser and matches its canvas
  artboard; the scene-id test passes.
- Upload: paste a text on localhost and the Vercel preview URL. The mail arrives, then the
  Chopper, the Translator (starting as the card lands) and the Archivist play in order;
  the bubbles go Waiting, Working, Done; the card pile shows the real chunk count; the text
  appears under "Your books"; `curl` against `/upload` shows the same events. With reduced
  motion on, each scene jumps to its end state; with network throttling on, no scene is
  skipped.
- Ask: a good question plays the Clerk leaving the Query room and writing on the board, the
  crew in order, the answer and the sources sidebar; an unanswerable one plays the "nothing
  found" ending and the Clerk shrugging; the Clerk is never in both rooms at once. Existing
  Ask tests still pass.
- Home: `/` shows the page; the hero, "Ask the office about me" and FAQ work.
