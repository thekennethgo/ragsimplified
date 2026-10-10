import gsap from "gsap";

import { reducedMotion } from "../motion";
import { at, spot, type Point } from "../spots";
import type { SceneSet, Timeline } from "../types";

const MIN_WALK = 0.4;
const SPEED = { clerk: 170, crew: 110 }; // room units per second; the Clerk is a brisk courier

// The canvas room's projection: room (x, y, z) to SVG (from OfficeAsk.dc.html's geometry()).
const iso = (x: number, y: number, z = 0) => ({
  x: 640 + 0.8 * (x - y),
  y: 210 + 0.4 * (x + y) - 0.8 * z,
});
const poly = (pts: number[][]) =>
  "M" +
  pts
    .map(([x, y, z]) => {
      const p = iso(x, y, z);
      return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join("L") +
  "Z";
const box = (x: number, y: number, z: number, w: number, d: number, h: number) => ({
  top: poly([
    [x, y, z + h],
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ]),
  fy: poly([
    [x, y + d, z + h],
    [x + w, y + d, z + h],
    [x + w, y + d, z],
    [x, y + d, z],
  ]),
  fx: poly([
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x + w, y + d, z],
    [x + w, y, z],
  ]),
});

const GROUP = {
  cl: "clerk",
  tr: "translator",
  sc: "scout",
  jd: "judge",
  st: "storyteller",
} as const;
type Who = keyof typeof GROUP;
const HOME_FACING_LEFT: Record<Who, boolean> = {
  cl: false,
  tr: true,
  sc: true,
  jd: false,
  st: false,
};

const ANSWER_TO = { x: -92, y: 18 }; // typewriter to the Clerk's clipboard
const HANDOVER_FROM = { x: 19, y: -61 }; // the papers in the Judge's hand, across the desk
const HANDOVER_TO = { x: -68, y: -84 }; // the Storyteller's raised hand
const KEPT_FROM = { x: -57, y: -35 }; // Storyteller's raised hand down onto the desk
const SHEETS_TO = { x: 634, y: 280 }; // the Scout's arms, at the Scout's spot

const SVGNS = "http://www.w3.org/2000/svg";
function el(parent: Element, tag: string, attrs: Record<string, string | number>) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent.appendChild(e);
  return e;
}
function boxGroup(
  parent: Element,
  id: string,
  b: ReturnType<typeof box>,
  colors: string[],
  extra?: string,
) {
  const g = el(parent, "g", { id, opacity: 0 });
  el(g, "path", { d: b.fy, fill: colors[0] });
  el(g, "path", { d: b.fx, fill: colors[1] });
  el(g, "path", { d: b.top, fill: colors[2] });
  if (extra) el(g, "path", { d: extra, fill: "none", stroke: "#B8AD98", "stroke-width": 0.8 });
  return g;
}

/** The Ask office: the Clerk at the whiteboard and the Translator, Scout, Judge and Storyteller (ADR 004). */
export function buildAskScenes(root: SVGSVGElement): SceneSet {
  const q = gsap.utils.selector(root);
  const holds: SceneSet["holds"] = {};
  const stopHold = (k: string) => {
    holds[k]?.kill();
    delete holds[k];
  };
  const startHold = (tl: gsap.core.Timeline, k: string, make: () => { kill(): void }) =>
    tl.eventCallback("onComplete", () => {
      if (!reducedMotion()) holds[k] = make();
    });

  // Feet positions (SVG coordinates), read from the spot markers in the SVG.
  const P = {
    doorway: spot(root, "clerk-doorway"), // inside the QUERY door
    door: spot(root, "clerk-door"), // on the door mat
    clAtBoard: spot(root, "clerk-board"), // beside the whiteboard's right end, his writing hand in view; he waits here too
    clAtStoryteller: spot(root, "clerk-storyteller"), // on the Storyteller's left, room above for a speech bubble
    trSpot: spot(root, "translator"),
    trAtScout: spot(root, "translator-scout"), // behind the Scout's right shoulder
    scSpot: spot(root, "scout"),
    scAtJudge: spot(root, "scout-judge"), // beside the Judge, left of the desk
    jdSpot: spot(root, "judge"),
    jdAcrossDesk: spot(root, "judge-desk"), // across the Storyteller's desk from her
    jdPastDesk: spot(root, "judge-past-desk"), // clear of the Storyteller's desk, on the way back
    jdAtClerk: spot(root, "judge-clerk"), // on the Clerk's right by the whiteboard, to tell them nothing was found
    jdAtFiles: spot(root, "judge-files"), // in front of the file cabinets
    stSpot: spot(root, "storyteller"),
  };
  const HOME: Partial<Record<Who, Point>> = {
    tr: P.trSpot,
    sc: P.scSpot,
    jd: P.jdSpot,
    st: P.stSpot,
  };

  // "Nothing found": set when the Judge keeps no results; the Storyteller then has nothing to type
  // and the Clerk comes back shrugging. In the app this comes from the Judge's done event.
  let nothingFound = false;

  // ---------- props drawn from the room's own projection ----------
  (function buildProps() {
    const props = root.querySelector("#a-props")!;
    const PAPER = ["#E6DDCB", "#D8CCB7", "#F7F2E8"];
    // the Translator's slip, lying on the desk where the printer feeds out
    const slip = el(props, "g", { id: "a-slip", opacity: 0 });
    el(slip, "path", {
      d: poly([
        [56, 438, 61],
        [72, 438, 61],
        [72, 447, 61],
        [56, 447, 61],
      ]),
      fill: "#F7F2E8",
      stroke: "#B8AD98",
      "stroke-width": 0.6,
    });
    el(slip, "path", {
      d: poly([
        [59, 441, 61.1],
        [69, 441, 61.1],
        [69, 442.4, 61.1],
        [59, 442.4, 61.1],
      ]),
      fill: "#6F8FA3",
    });
    // the big pile on the Judge's desk; after judging it becomes the canvas's kept stack plus the rejects
    const lines = [64, 68, 72]
      .map((z) =>
        poly([
          [296, 60, z],
          [320, 60, z],
          [320, 60.1, z + 0.6],
          [296, 60.1, z + 0.6],
        ]),
      )
      .join(" ");
    boxGroup(props, "j-pile", box(296, 40, 60, 24, 20, 16), PAPER, lines);
    boxGroup(props, "j-rejects", box(296, 60, 60, 22, 16, 8), PAPER);
    // the kept documents on the Storyteller's desk (back right, beside the question copy)
    boxGroup(props, "st-kept", box(618, 172, 58, 22, 14, 5), PAPER);
    // sheets that fly out of the lit drawers into the Scout's arms
    [
      [560, 200],
      [536, 222],
      [604, 196],
      [528, 252],
      [575, 240],
      [590, 222],
    ].forEach(([x, y]) =>
      el(props, "rect", {
        class: "a-sheet",
        x: x - 6,
        y: y - 4,
        width: 12,
        height: 8,
        rx: 0.8,
        fill: "#F7F2E8",
        stroke: "#B8AD98",
        "stroke-width": 0.6,
        opacity: 0,
      }),
    );
    // the Storyteller's typed lines, one per beat (like the canvas's paperLines)
    [16, 13, 17, 11, 15].forEach((w, k) =>
      el(root.querySelector("#typed-lines")!, "path", {
        class: "typed-line",
        d: poly([
          [581, 180.3, 94 - k * 5.5],
          [581 + w, 180.3, 94 - k * 5.5],
          [581 + w, 180.3, 95.6 - k * 5.5],
          [581, 180.3, 95.6 - k * 5.5],
        ]),
        fill: "#8C7660",
        opacity: 0,
      }),
    );
  })();

  // Depth: reset puts the Judge back in the crew's depth order.
  const judgeEl = root.querySelector("#judge")!;
  const judgeTo = (before: Element) => () => {
    before.parentNode!.insertBefore(judgeEl, before);
  };
  const inCrew = judgeTo(root.querySelector("#translator")!); // the Judge's usual place in the crew's depth order
  const behindDesk = judgeTo(root.querySelector("#sdesk")!); // across the Storyteller's desk the desk hides his legs

  // ---------- walking ----------
  const pos: Partial<Record<Who, Point>> = {}; // where each character's feet are, for walk directions and durations
  function walk(tl: gsap.core.Timeline, who: Who, to: Point, position?: gsap.Position, pace = 1) {
    const from = pos[who]!;
    pos[who] = to;
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    return tl
      .set(q(`#${who}-flip`), { scaleX: to.x < from.x ? -1 : 1 }, position)
      .to(q(`#${GROUP[who]}`), {
        ...at(to),
        duration: Math.max(MIN_WALK / pace, d / (SPEED[who === "cl" ? "clerk" : "crew"] * pace)),
        ease: "power1.inOut",
      });
  }
  const face = (tl: gsap.core.Timeline, who: Who, left: boolean, position?: gsap.Position) =>
    tl.set(q(`#${who}-flip`), { scaleX: left ? -1 : 1 }, position);
  const faceHome = (tl: gsap.core.Timeline, who: Who) => face(tl, who, HOME_FACING_LEFT[who]);
  const clerkPose = (tl: gsap.core.Timeline, give: boolean, position?: gsap.Position) =>
    tl
      .set(q("#cl-give"), { opacity: give ? 1 : 0 }, position)
      .set(q("#cl-wait, #cl-clip-side"), { opacity: give ? 0 : 1 }, "<");
  // arm up (working pose) or down for the Scout, Judge and Storyteller
  const armUp = (tl: gsap.core.Timeline, who: Who, up: boolean, position?: gsap.Position) =>
    tl
      .set(q(`#${who}-arm-up`), { opacity: up ? 1 : 0 }, position)
      .set(q(`#${who}-arm-down, #${who}-tool-down`), { opacity: up ? 0 : 1 }, "<");

  function reset() {
    Object.keys(holds).forEach(stopHold);
    // no Clerk, door shut
    pos.cl = P.doorway;
    gsap.set(q("#clerk"), { ...at(P.doorway), opacity: 0 });
    gsap.set(q("#cl-wait, #cl-clip-side"), { opacity: 1 });
    gsap.set(q("#cl-give, #cl-write, #a-door-open, #a-answer"), { opacity: 0, x: 0, y: 0 });
    // the crew at their desks, facing their work
    inCrew();
    nothingFound = false;
    gsap.set(q("#jd-puzzled, #jd-says, #a-handover"), { opacity: 0, x: 0, y: 0 });
    gsap.set(q("#jd-flip"), { rotation: 0 });
    for (const who of Object.keys(HOME) as Who[]) {
      pos[who] = HOME[who];
      gsap.set(q(`#${GROUP[who]}`), at(HOME[who]!));
    }
    for (const who of Object.keys(GROUP) as Who[]) {
      gsap.set(q(`#${who}-flip`), { svgOrigin: "40 0", scaleX: HOME_FACING_LEFT[who] ? -1 : 1 });
    }
    gsap.set(q("#sc-arm-up, #jd-arm-up, #st-arm-up"), { opacity: 0, x: 0, y: 0 });
    gsap.set(
      q(
        "#sc-arm-down, #sc-tool-down, #jd-arm-down, #jd-tool-down, #st-arm-down, #st-tool-down, #tr-arm-r",
      ),
      { opacity: 1 },
    );
    gsap.set(q("#tr-check, #sc-check, #jd-check, #st-check"), { opacity: 0 });
    gsap.set(q("#tr-held-slip, #sc-held-slip, #sc-held-stack, #jd-held-kept, #jd-held-rejects"), {
      opacity: 0,
    });
    // Translator's desk
    gsap.set(q("#crt-text-idle, #tr-work"), { opacity: 1 });
    gsap.set(q("#tr-in-card, #crt-cursor, .crt-line, .crt-bar, #a-slip"), {
      opacity: 0,
      x: 0,
      y: 0,
    });
    gsap.set(q("#printer"), { x: 0 });
    gsap.set(q("#printer-led"), { opacity: 0.3 });
    // Scout's cabinets, Judge's desk and board, Storyteller's typewriter
    gsap.set(
      q(
        "#lantern-beam, #lantern-glow, .a-sheet, #j-pile, #j-rejects, #kept-stack, #d-kept, #st-kept, #answer-dots, .typed-line, #typer-lines-static",
      ),
      { opacity: 0, x: 0, y: 0 },
    );
    gsap.set(q("#d-kept > *"), { opacity: 1 });
    gsap.set(q("#desk-mag-lens, #desk-mag-handle"), { opacity: 1 });
    gsap.set(q("#typewriter"), { x: 0 });
  }

  // Judge, nothing kept: puzzled at the pile, tells the Clerk, then files the whole pile back.
  function judgeNothing() {
    nothingFound = true;
    const tl = gsap.timeline({ paused: true });
    tl.to(q("#jd-arm-up"), { x: 0, duration: 0.2 })
      .fromTo(
        q("#jd-puzzled"),
        { opacity: 0, scale: 0.4, transformOrigin: "50% 100%" },
        { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" },
      )
      .to(q("#jd-flip"), { rotation: -5, svgOrigin: "40 116", duration: 0.25, ease: "sine.inOut" }) // head tilt, twice
      .to(q("#jd-flip"), { rotation: 5, duration: 0.4, ease: "sine.inOut" })
      .to(q("#jd-flip"), { rotation: -5, duration: 0.4, ease: "sine.inOut" })
      .to(q("#jd-flip"), { rotation: 0, duration: 0.25, ease: "sine.inOut" })
      .to(q("#j-pile"), { opacity: 0, duration: 0.25 }) // nothing kept: it all becomes rejects
      .to(q("#j-rejects"), { opacity: 1, duration: 0.25 }, "<");
    armUp(tl, "jd", false);
    tl.set(q("#desk-mag-lens, #desk-mag-handle"), { opacity: 1 }, "<")
      .to(q("#jd-puzzled"), { opacity: 0, duration: 0.2 }, "<")
      .set(q("#j-rejects"), { opacity: 0 }, "+=0.2")
      .set(q("#jd-held-rejects"), { opacity: 1 }, "<");
    walk(tl, "jd", P.jdAtClerk, "+=0.1");
    face(tl, "jd", true); // turn to the Clerk
    face(tl, "cl", false, "<"); // and the Clerk turns to the Judge
    tl.fromTo(
      q("#jd-says"),
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
      "+=0.1",
    )
      .to(q("#jd-says"), { opacity: 0, duration: 0.3 }, "+=1.8")
      .addLabel("handoff"); // the Clerk knows: they can head back
    walk(tl, "jd", P.jdAtFiles, "+=0.1");
    tl.to(q("#jd-held-rejects"), { x: -8, opacity: 0, duration: 0.35 }, "+=0.1") // all back into the cabinets
      .set(q("#jd-held-rejects"), { x: 0 });
    walk(tl, "jd", P.jdSpot, "+=0.2");
    faceHome(tl, "jd");
    return tl;
  }
  const nothingToDo = () => gsap.timeline({ paused: true }).to({}, { duration: 0.01 });

  // ---------- scenes: each returns a paused timeline ----------
  const scenes: Record<string, (data?: Record<string, unknown>) => gsap.core.Timeline> = {
    // In through the QUERY door, behind the whiteboard, writes the question on it for the crew,
    // then waits on the Storyteller's left.
    clerk_start() {
      const tl = gsap.timeline({ paused: true });
      pos.cl = P.doorway;
      tl.add(reset)
        .set(q("#clerk"), at(P.doorway))
        .set(q("#cl-flip"), { scaleX: 1 })
        .to(q("#a-door-open"), { opacity: 1, duration: 0.2 })
        .to(q("#clerk"), { opacity: 1, duration: 0.3 });
      walk(tl, "cl", P.door);
      tl.to(q("#a-door-open"), { opacity: 0, duration: 0.25 });
      walk(tl, "cl", P.clAtBoard, "<"); // straight along behind the whiteboard to its right end
      face(tl, "cl", true); // facing the board; his arm goes round its edge
      tl.set(q("#cl-wait, #cl-clip-side"), { opacity: 0 }, "+=0.1").set(
        q("#cl-write"),
        { opacity: 1, x: 0, y: 0 },
        "<",
      );
      [
        [3, -6],
        [-2, 1],
        [4, -4],
        [-1, 3],
        [3, -2],
        [0, 4],
      ].forEach(([x, y]) =>
        // six strokes of the marker, in view at the board's edge
        tl.to(q("#cl-write"), { x, y, duration: 0.24, ease: "sine.inOut" }),
      );
      tl.to(q("#cl-write"), { x: 0, y: 0, duration: 0.15 })
        .set(q("#cl-write"), { opacity: 0 })
        .set(q("#cl-wait, #cl-clip-side"), { opacity: 1 }, "<")
        .addLabel("handoff"); // the question is on the board: the Translator can start
      face(tl, "cl", false, "+=0.2"); // then waits beside the board, facing the room
      return tl;
    },

    // Translator: reads the question off the whiteboard and types it into the computer.
    translator_start() {
      const tl = gsap.timeline({ paused: true });
      face(tl, "tr", false); // looks over at the board
      face(tl, "tr", true, "+=0.6"); // and back to the keyboard
      tl.to(q("#crt-text-idle"), { opacity: 0, duration: 0.2 }).set(q("#crt-cursor"), {
        opacity: 1,
      });
      q(".crt-line").forEach((line) => tl.to(line, { opacity: 1, duration: 0.05 }, "+=0.3"));
      tl.to([...q(".crt-line"), ...q("#crt-cursor")], { opacity: 0, duration: 0.2 }, "+=0.3").to(
        q(".crt-bar").slice(0, 3),
        { opacity: 1, duration: 0.05, stagger: 0.3 },
      );
      startHold(tl, "translator", () =>
        gsap.fromTo(
          q(".crt-bar")[3],
          { opacity: 0.15 },
          { opacity: 0.8, duration: 0.45, repeat: -1, yoyo: true, ease: "sine.inOut" },
        ),
      );
      return tl;
    },

    // Translator: the printer gives a small slip, which goes over to the Scout.
    translator_done() {
      const tl = gsap.timeline({ paused: true });
      tl.to(q(".crt-bar")[3], { opacity: 1, duration: 0.1 })
        .addLabel("print")
        .to(q("#printer-led"), { opacity: 1, duration: 0.08, repeat: 5, yoyo: true }, "print")
        .fromTo(
          q("#printer"),
          { x: -0.6 },
          { x: 0.6, duration: 0.06, repeat: 7, yoyo: true, ease: "none" },
          "print",
        )
        .set(q("#printer"), { x: 0 })
        .fromTo(
          q("#a-slip"),
          { x: -11, y: -6, opacity: 0 },
          { x: 0, y: 0, opacity: 1, duration: 0.5, ease: "power1.out" },
          "print+=0.1",
        )
        .set(q("#printer-led"), { opacity: 0.3 })
        .to(q("#a-slip"), { opacity: 0, duration: 0.15 }, "+=0.2") // picks it up
        .set(q("#tr-held-slip"), { opacity: 1 }, "<");
      walk(tl, "tr", P.trAtScout, "+=0.1");
      face(tl, "tr", true);
      tl.set(q("#tr-held-slip"), { opacity: 0 }, "+=0.15")
        .set(q("#sc-held-slip"), { opacity: 1 }, "<")
        .addLabel("handoff"); // the Scout has the slip
      walk(tl, "tr", P.trSpot, "+=0.2");
      faceHome(tl, "tr");
      tl.to(q(".crt-bar"), { opacity: 0, duration: 0.2 }).to(
        q("#crt-text-idle"),
        { opacity: 1, duration: 0.2 },
        "<",
      );
      return tl;
    },

    // Scout: holds up the lantern; its light finds the drawers that match.
    scout_start() {
      const tl = gsap.timeline({ paused: true });
      tl.set(q("#sc-held-slip"), { opacity: 0 });
      armUp(tl, "sc", true);
      const lantern = q("#sc-arm-up, #lantern-glow");
      tl.to(q("#lantern-glow"), { opacity: 1, duration: 0.3 })
        .to(q("#lantern-beam"), { opacity: 1, duration: 0.6 }, "<0.1")
        .to(lantern, { x: -6, y: 3, duration: 0.8, ease: "sine.inOut" }) // searching: the lantern sweeps along the drawers
        .to(lantern, { x: 4, y: -2, duration: 1.1, ease: "sine.inOut" })
        .to(lantern, { x: -3, y: 2, duration: 0.9, ease: "sine.inOut" })
        .to(lantern, { x: 0, y: 0, duration: 0.6, ease: "sine.inOut" });
      startHold(tl, "scout", () =>
        gsap.to(q("#lantern-beam"), {
          opacity: 0.55,
          duration: 0.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        }),
      );
      return tl;
    },

    // Scout: pulls a big stack of documents and carries it to the Judge's desk.
    scout_done() {
      const tl = gsap.timeline({ paused: true });
      tl.to(q("#lantern-beam"), { opacity: 1, duration: 0.2 });
      q(".a-sheet").forEach((s, i) => {
        const b = { x: +s.getAttribute("x")! + 6, y: +s.getAttribute("y")! + 4 };
        tl.fromTo(s, { x: 0, y: 0, opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.25 + i * 0.12)
          .to(
            s,
            { x: SHEETS_TO.x - b.x, y: SHEETS_TO.y - b.y, duration: 0.45, ease: "power2.in" },
            ">",
          )
          .set(s, { opacity: 0 });
      });
      tl.set(q("#sc-held-stack"), { opacity: 1 }, "-=0.3").to(q("#lantern-beam, #lantern-glow"), {
        opacity: 0,
        duration: 0.3,
      });
      armUp(tl, "sc", false, "<");
      walk(tl, "sc", P.scAtJudge, "+=0.1");
      tl.set(q("#sc-held-stack"), { opacity: 0 }, "+=0.1") // onto the Judge's desk
        .fromTo(
          q("#j-pile"),
          { x: -120, y: 15, opacity: 0 },
          { x: 0, y: 0, opacity: 1, duration: 0.5, ease: "power2.out" },
          "<",
        )
        .addLabel("handoff"); // the pile is on the Judge's desk
      walk(tl, "sc", P.scSpot, "+=0.2");
      faceHome(tl, "sc");
      return tl;
    },

    // Judge: goes over the pile with the magnifying glass.
    judge_start() {
      const tl = gsap.timeline({ paused: true });
      tl.set(q("#desk-mag-lens, #desk-mag-handle"), { opacity: 0 });
      armUp(tl, "jd", true);
      tl.to(q("#jd-arm-up"), { x: -3, duration: 0.4, ease: "sine.inOut" });
      startHold(tl, "judge", () =>
        gsap.fromTo(
          q("#jd-arm-up"),
          { x: -3 },
          { x: 3, duration: 0.7, repeat: -1, yoyo: true, ease: "sine.inOut" },
        ),
      );
      return tl;
    },

    // Judge: ranks the best, hands them to the Storyteller, then files the rest back.
    // With nothing kept: puzzled, tells the Clerk no file was found, files everything back.
    judge_done(data = {}) {
      if (data.nothing) return judgeNothing();
      const tl = gsap.timeline({ paused: true });
      tl.to(q("#jd-arm-up"), { x: 0, duration: 0.2 })
        .set(q("#d-kept"), { opacity: 1 })
        .fromTo(q("#d-kept > *"), { opacity: 0 }, { opacity: 1, duration: 0.15, stagger: 0.12 }) // ranks on the board
        .to(q("#j-pile"), { opacity: 0, duration: 0.25 })
        .to(q("#kept-stack, #j-rejects"), { opacity: 1, duration: 0.25 }, "<");
      armUp(tl, "jd", false);
      tl.set(q("#desk-mag-lens, #desk-mag-handle"), { opacity: 1 }, "<")
        .set(q("#kept-stack, #j-rejects"), { opacity: 0 }, "+=0.2")
        .set(q("#jd-held-kept, #jd-held-rejects"), { opacity: 1 }, "<");
      // straight over to the far side of the Storyteller's desk, across from her
      tl.call(behindDesk, undefined, "+=0.1");
      walk(tl, "jd", P.jdAcrossDesk);
      face(tl, "jd", true); // facing the Storyteller
      // hand to hand: the papers go into the Storyteller's raised hand, then onto the desk
      tl.set(q("#jd-held-kept"), { opacity: 0 }, "+=0.1")
        .set(q("#a-handover"), { ...HANDOVER_FROM, opacity: 1 }, "<") // (a set, not a fromTo: a fromTo would show it from the start)
        .to(q("#a-handover"), { ...HANDOVER_TO, duration: 0.45, ease: "power2.inOut" }, "<");
      armUp(tl, "st", true);
      tl.set(q("#a-handover"), { opacity: 0 }, "<");
      armUp(tl, "st", false, "+=0.5");
      tl.fromTo(
        q("#st-kept"),
        { ...KEPT_FROM, opacity: 0 },
        { x: 0, y: 0, opacity: 1, duration: 0.35, ease: "power2.out" },
        "<",
      ).addLabel("handoff"); // the documents are on the Storyteller's desk
      walk(tl, "jd", P.jdPastDesk, "+=0.2");
      tl.call(inCrew);
      walk(tl, "jd", P.jdAtFiles);
      tl.to(q("#jd-held-rejects"), { x: -8, opacity: 0, duration: 0.35 }, "+=0.1") // back into the cabinet
        .set(q("#jd-held-rejects"), { x: 0 });
      walk(tl, "jd", P.jdSpot, "+=0.2");
      faceHome(tl, "jd");
      return tl;
    },

    // Storyteller: reads the documents and starts typing.
    storyteller_start() {
      if (nothingFound) return nothingToDo();
      const tl = gsap.timeline({ paused: true });
      q(".typed-line")
        .slice(0, 2)
        .forEach((line) => {
          tl.to(q("#typewriter"), { x: 0.8, duration: 0.05, repeat: 5, yoyo: true }, "+=0.15").to(
            line,
            {
              opacity: 1,
              duration: 0.05,
            },
          );
        });
      startHold(tl, "storyteller", () =>
        gsap
          .timeline({ repeat: -1 })
          .to(q("#typewriter"), { x: 0.8, duration: 0.05, repeat: 7, yoyo: true })
          .to(q("#key-dots"), { opacity: 0.6, duration: 0.08, repeat: 3, yoyo: true }, "<")
          .to({}, { duration: 0.3 }),
      );
      return tl;
    },

    // Storyteller: finishes the page; the answer waits on the typewriter for the Clerk.
    storyteller_done() {
      if (nothingFound) return nothingToDo();
      const tl = gsap.timeline({ paused: true });
      tl.set(q("#key-dots"), { opacity: 1 });
      q(".typed-line")
        .slice(2)
        .forEach((line) => {
          tl.to(q("#typewriter"), { x: 0.8, duration: 0.05, repeat: 5, yoyo: true }, "+=0.1").to(
            line,
            {
              opacity: 1,
              duration: 0.05,
            },
          );
        });
      tl.to(q("#answer-dots"), { opacity: 1, duration: 0.2 }, "+=0.1"); // the citation marks
      armUp(tl, "st", true, "+=0.2"); // holds up the finished page
      armUp(tl, "st", false, "+=0.8");
      tl.fromTo(q("#a-answer"), { opacity: 0 }, { opacity: 1, duration: 0.25 }, "<");
      return tl;
    },

    // Take the answer from the Storyteller and leave by the QUERY door.
    clerk_done() {
      const tl = gsap.timeline({ paused: true });
      if (!nothingFound) {
        walk(tl, "cl", P.clAtStoryteller, undefined, 2.2); // over from the board; walking right, so facing the Storyteller
        clerkPose(tl, true);
        tl.fromTo(
          q("#a-answer"),
          { x: 0, y: 0, opacity: 1 },
          { ...ANSWER_TO, duration: 0.25, ease: "power2.inOut" },
        ).to(q("#a-answer"), { opacity: 0, duration: 0.15 });
        clerkPose(tl, false);
      }
      walk(tl, "cl", P.door, undefined, 2.2);
      tl.to(q("#a-door-open"), { opacity: 1, duration: 0.12 });
      walk(tl, "cl", P.doorway, undefined, 2.2);
      tl.to(q("#clerk"), { opacity: 0, duration: 0.12 }, "-=0.2")
        .addLabel("handoff") // gone through the door: he is back in the Query room straight away
        .to(q("#a-door-open"), { opacity: 0, duration: 0.12 });
      return tl;
    },
  };

  return { reset, scenes: scenes as unknown as Record<string, () => Timeline>, holds };
}
