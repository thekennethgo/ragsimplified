import gsap from "gsap";

import { reducedMotion } from "../motion";
import { at, spot, type Point } from "../spots";
import type { SceneSet, Timeline } from "../types";

const WALK_SPEED = 90; // room units per second
const PRINTOUT_ON_TABLE = { x: 58.8, y: -5.8 };
const BLADE_UP = 22;
const BLADE_DOWN = -5; // cutter-blade rotation around its pivot
const LINE_END = [714.7, 708.3, 717.9, 711.5, 705.1];

const GROUP = { ch: "chopper", tr: "translator", ar: "archivist" } as const;
type Who = keyof typeof GROUP;

/** The Upload office: the Chopper, the Translator and the Archivist (ADR 004). */
export function buildUploadScenes(root: SVGSVGElement): SceneSet {
  const q = gsap.utils.selector(root);
  const holds: SceneSet["holds"] = {};
  const stopHold = (k: string) => {
    holds[k]?.kill();
    delete holds[k];
  };

  // Feet positions in room coordinates, read from the spot markers in the SVG.
  const P = {
    chSpot: spot(root, "chopper"),
    chInbox: spot(root, "chopper-inbox"),
    chTray: spot(root, "chopper-tray"),
    trSpot: spot(root, "translator"),
    trStamp: spot(root, "translator-stamp"),
    arSpot: spot(root, "archivist"),
    arAround: spot(root, "archivist-around"),
    arTable: spot(root, "archivist-table"),
  };

  const lines = q("#crt-lines path");
  const progress = q("#crt-progress path");
  const cutCards = q("#cut-cards path");
  const cardA = cutCards.slice(0, 3);
  const cardB = cutCards.slice(3, 6);
  const cursorAt = (i: number, end: boolean) => {
    const dx = end ? LINE_END[i] - 697 : 0;
    return { x: dx, y: -15.6 + 3.2 * i + dx * 0.5 };
  };

  // Depth: the printout lives in the printer's layer, but on the stamping table it must sit
  // behind the stamp carousel. Same coordinate space, so moving the node keeps its transform.
  const printoutEl = root.querySelector("#printout")!;
  const printoutHome = printoutEl.nextElementSibling!;
  const toLayer = (before: Element) => () => {
    before.parentNode!.insertBefore(printoutEl, before);
  };

  // Walk in a straight line (no bob), facing the direction of travel. Duration follows distance.
  function walk(tl: gsap.core.Timeline, who: Who, from: Point, to: Point, pos?: gsap.Position) {
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    return tl
      .set(q(`#${who}-flip`), { scaleX: to.x < from.x ? -1 : 1 }, pos)
      .to(q(`#${GROUP[who]}`), {
        ...at(to),
        duration: Math.max(0.6, d / WALK_SPEED),
        ease: "power1.inOut",
      });
  }
  const face = (tl: gsap.core.Timeline, who: Who, left: boolean) =>
    tl.set(q(`#${who}-flip`), { scaleX: left ? -1 : 1 });

  function reset() {
    Object.keys(holds).forEach(stopHold);
    // characters
    gsap.set(q("#chopper"), at(P.chSpot));
    gsap.set(q("#translator"), at(P.trSpot));
    gsap.set(q("#archivist"), at(P.arSpot));
    gsap.set(q("#ch-flip, #tr-flip, #ar-flip"), { svgOrigin: "40 0" });
    gsap.set(q("#ch-flip"), { scaleX: -1 }); // Chopper faces the bench (left)
    gsap.set(q("#tr-flip, #ar-flip"), { scaleX: 1 });
    gsap.set(q("#ch-arm-down, #ch-tool-down, #tr-arm-r, #ar-arm-down"), { opacity: 1 });
    gsap.set(q("#ch-arm-up, #tr-stamp-arm, #tr-stamp-held, #ar-arm-up"), { opacity: 0, y: 0 });
    gsap.set(q("#tr-stamp-press"), { y: 0 });
    gsap.set(q("#ch-held-env, #ch-held-card, #ar-held-page"), { opacity: 0 });
    gsap.set(q("#ch-check, #tr-check, #ar-check"), { opacity: 0 });
    // Chopper's bench
    gsap.set(q("#envelope"), { y: 0, opacity: 0 }); // no mail yet
    gsap.set(q("#cutter-sheet"), { y: 0, opacity: 0 });
    gsap.set(cutCards, { opacity: 0 });
    gsap.set(q("#cutter-blade"), { rotation: 0, svgOrigin: "372.8 354.8" });
    // Translator's desk
    gsap.set(q("#in-card"), { x: 0, y: 0, opacity: 0 });
    gsap.set(q("#crt-text-idle"), { opacity: 1 });
    gsap.set([...lines, ...progress], { opacity: 0 });
    gsap.set(q("#crt-cursor"), { x: 0, y: 0, opacity: 0 });
    gsap.set(q("#printer"), { x: 0 });
    gsap.set(q("#printer-led"), { opacity: 0.3 });
    toLayer(printoutHome)();
    gsap.set(q("#printout"), { x: 0, y: 0, opacity: 0 });
    gsap.set(q("#stamp-mark"), { opacity: 0 });
    // Archivist's cabinets
    gsap.set(q("#cabinet-drawer"), { x: 12, y: -6, opacity: 0 });
  }

  // One chop: blade + scissors arm come down together.
  function chop(tl: gsap.core.Timeline, onHit?: (t: gsap.core.Timeline) => void) {
    tl.to(q("#cutter-blade"), { rotation: BLADE_DOWN, duration: 0.14, ease: "power2.in" }).to(
      q("#ch-arm-up"),
      { y: 6, duration: 0.14, ease: "power2.in" },
      "<",
    );
    if (onHit) onHit(tl);
    return tl
      .to(q("#cutter-blade"), { rotation: BLADE_UP, duration: 0.3, ease: "power1.out" })
      .to(q("#ch-arm-up"), { y: 0, duration: 0.3, ease: "power1.out" }, "<");
  }

  // ---------- scenes: each returns a paused timeline ----------
  const scenes: Record<string, () => gsap.core.Timeline> = {
    chopper_start() {
      const tl = gsap.timeline({ paused: true });
      tl.add(reset).fromTo(
        q("#envelope"),
        { y: -10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" },
      ); // mail arrives on top of the inbox
      walk(tl, "ch", P.chSpot, P.chInbox, "-=0.2");
      tl.to(q("#envelope"), { y: -8, opacity: 0, duration: 0.3 }) // take the document
        .set(q("#ch-held-env"), { opacity: 1 }, "<0.15");
      walk(tl, "ch", P.chInbox, P.chSpot, "+=0.15");
      face(tl, "ch", true) // back to the bench
        .set(q("#ch-held-env"), { opacity: 0 })
        .fromTo(q("#cutter-sheet"), { y: -4, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 })
        .set(q("#ch-arm-down, #ch-tool-down"), { opacity: 0 })
        .set(q("#ch-arm-up"), { opacity: 1 })
        .to(q("#cutter-blade"), { rotation: BLADE_UP, duration: 0.25 });
      tl.eventCallback("onComplete", () => {
        if (reducedMotion()) return;
        // "Still chunking": keep chopping until chopper_done arrives.
        holds.chopper = chop(gsap.timeline({ repeat: -1, repeatDelay: 0.15 }));
      });
      return tl;
    },

    chopper_done() {
      const tl = gsap.timeline({ paused: true });
      tl.to(q("#cutter-blade"), { rotation: BLADE_UP, duration: 0.1 });
      chop(tl, (t) =>
        t.set(cardA, { opacity: 1 }).to(q("#cutter-sheet"), { opacity: 0.5, duration: 0.1 }, "<"),
      );
      chop(tl, (t) =>
        t.set(cardB, { opacity: 1 }).to(q("#cutter-sheet"), { opacity: 0, duration: 0.1 }, "<"),
      );
      tl.to(q("#cutter-blade"), { rotation: 0, duration: 0.25 })
        .set(q("#ch-arm-up"), { opacity: 0 })
        .set(q("#ch-arm-down, #ch-tool-down"), { opacity: 1 })
        .set(cardB, { opacity: 0 }, "+=0.2") // pick up the top card
        .set(q("#ch-held-card"), { opacity: 1 }, "<");
      walk(tl, "ch", P.chSpot, P.chTray, "+=0.1");
      tl.set(q("#ch-held-card"), { opacity: 0 }) // drop it in the in-tray
        .fromTo(
          q("#in-card"),
          { x: -8, y: 4, opacity: 0 },
          { x: 0, y: 0, opacity: 1, duration: 0.35, ease: "power2.out" },
          "<",
        )
        .addLabel("handoff"); // card is in the tray: the Translator can start while the Chopper walks back
      walk(tl, "ch", P.chTray, P.chSpot, "+=0.2");
      return tl;
    },

    translator_start() {
      const tl = gsap.timeline({ paused: true });
      tl.to(q("#in-card"), { opacity: 0, y: -6, duration: 0.35 }) // card picked up
        .to(q("#crt-text-idle"), { opacity: 0, duration: 0.2 }, "<")
        .set(q("#crt-cursor"), { opacity: 1, ...cursorAt(0, false) });
      lines.forEach((line, i) => {
        tl.set(q("#crt-cursor"), cursorAt(i, false))
          .to(line, { opacity: 1, duration: 0.05 })
          .to(q("#crt-cursor"), { ...cursorAt(i, true), duration: 0.3, ease: "steps(6)" }, "<");
      });
      tl.to([...lines, ...q("#crt-cursor")], { opacity: 0, duration: 0.2 }, "+=0.3").to(
        progress.slice(0, 3),
        {
          opacity: 1,
          duration: 0.05,
          stagger: 0.35,
        },
      );
      tl.eventCallback("onComplete", () => {
        if (reducedMotion()) return;
        // "Still embedding": the last progress block pulses until translator_done arrives.
        holds.translator = gsap.fromTo(
          progress[3],
          { opacity: 0.15 },
          { opacity: 0.8, duration: 0.45, repeat: -1, yoyo: true, ease: "sine.inOut" },
        );
      });
      return tl;
    },

    translator_done() {
      const tl = gsap.timeline({ paused: true });
      // print
      tl.to(progress[3], { opacity: 1, duration: 0.1 })
        .addLabel("print")
        .to(q("#printer-led"), { opacity: 1, duration: 0.08, repeat: 7, yoyo: true }, "print")
        .fromTo(
          q("#printer"),
          { x: -0.7 },
          { x: 0.7, duration: 0.06, repeat: 11, yoyo: true, ease: "none" },
          "print",
        )
        .set(q("#printer"), { x: 0 })
        .fromTo(
          q("#printout"),
          { x: 10, y: -5, opacity: 0 },
          { x: 0, y: 0, opacity: 1, duration: 0.8, ease: "power1.out" },
          "print+=0.1",
        )
        .set(q("#printer-led"), { opacity: 0.3 })
        // walk to stamping while the printout moves to the table
        .addLabel("walk", "+=0.2")
        .to(q("#translator"), { ...at(P.trStamp), duration: 1.2, ease: "power1.inOut" }, "walk")
        .to(q("#printout"), { ...PRINTOUT_ON_TABLE, duration: 1.2, ease: "power1.inOut" }, "walk")
        .call(toLayer(root.querySelector("#stamp-carousel")!))
        // stamp x3
        .set(q("#tr-arm-r"), { opacity: 0 })
        .set(q("#tr-stamp-arm"), { opacity: 1 });
      for (let i = 0; i < 3; i++) {
        tl.to(
          q("#tr-stamp-press"),
          { y: 16, duration: 0.14, ease: "power2.in" },
          i ? "+=0.08" : "+=0.15",
        );
        if (i === 0) tl.set(q("#stamp-mark"), { opacity: 1 });
        tl.to(q("#tr-stamp-press"), { y: 0, duration: 0.2, ease: "power2.out" });
      }
      tl.addLabel("handoff") // stamped: the Archivist can come for it while the Translator walks back
        .set(q("#tr-stamp-arm"), { opacity: 0 })
        .set(q("#tr-arm-r"), { opacity: 1 });
      walk(tl, "tr", P.trStamp, P.trSpot, "+=0.2");
      face(tl, "tr", false)
        .to(progress, { opacity: 0, duration: 0.2 })
        .to(q("#crt-text-idle"), { opacity: 1, duration: 0.2 }, "<");
      return tl;
    },

    archivist_start() {
      const tl = gsap.timeline({ paused: true });
      // Go round the front of the book cart (a straight line would pass behind it).
      walk(tl, "ar", P.arSpot, P.arAround);
      walk(tl, "ar", P.arAround, P.arTable);
      tl.to(
        q("#printout"),
        { x: PRINTOUT_ON_TABLE.x + 8, y: PRINTOUT_ON_TABLE.y + 4, opacity: 0, duration: 0.3 },
        "+=0.1",
      ).set(q("#ar-held-page"), { opacity: 1 }, "<0.15");
      walk(tl, "ar", P.arTable, P.arAround, "+=0.15");
      walk(tl, "ar", P.arAround, P.arSpot);
      face(tl, "ar", false) // face the cabinets
        .to(q("#cabinet-drawer"), { x: 0, y: 0, opacity: 1, duration: 0.4, ease: "power2.out" })
        .set(q("#ar-held-page"), { opacity: 0 })
        .set(q("#ar-arm-down"), { opacity: 0 }, "<")
        .set(q("#ar-arm-up"), { opacity: 1 }, "<");
      tl.eventCallback("onComplete", () => {
        if (reducedMotion()) return;
        // "Still storing": hold the folder over the open drawer, nudging it, until archivist_done.
        holds.archivist = gsap.to(q("#ar-arm-up"), {
          y: 3,
          duration: 0.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
      return tl;
    },

    archivist_done() {
      const tl = gsap.timeline({ paused: true });
      tl.to(q("#ar-arm-up"), { y: 12, duration: 0.3, ease: "power2.in" }) // drop it in
        .set(q("#ar-arm-up"), { opacity: 0, y: 0 })
        .set(q("#ar-arm-down"), { opacity: 1 })
        .to(q("#cabinet-drawer"), { x: 12, y: -6, duration: 0.35, ease: "power2.in" }, "+=0.15")
        .set(q("#cabinet-drawer"), { opacity: 0 });
      return tl;
    },
  };

  return { reset, scenes: scenes as unknown as Record<string, () => Timeline>, holds };
}
