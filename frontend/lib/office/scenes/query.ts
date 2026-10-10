import gsap from "gsap";

import type { SceneSet, Timeline } from "../types";

const Q_DOOR = "90 172"; // Query room: where the Clerk shrinks toward in the doorway

/** The Query room: the Clerk behind the counter takes the question, goes away and comes back (ADR 004). */
export function buildQueryScenes(root: SVGSVGElement): SceneSet {
  const q = gsap.utils.selector(root);

  // The Clerk at the counter, waving, door shut.
  function reset() {
    gsap.set(q("#q-clerk"), { opacity: 1, y: 0, scale: 1, svgOrigin: Q_DOOR });
    gsap.set(q("#q-front, #q-wave-arms, #q-wave-clip, #q-door-shut"), { opacity: 1 });
    gsap.set(
      q("#q-back, #q-present-arms, #q-present-page, #q-shrug-arms, #q-door-open, #q-back-soon"),
      { opacity: 0 },
    );
  }

  // Back through the door, turn round, then show the answer (clerk_back) or shrug (clerk_shrug).
  function comeBack(shrug: boolean) {
    const tl = gsap.timeline({ paused: true });
    tl.set(q("#q-door-shut"), { opacity: 0 })
      .set(q("#q-door-open, #q-back"), { opacity: 1 })
      .set(q("#q-front"), { opacity: 0 })
      .fromTo(q("#q-clerk"), { y: -6, scale: 0.86, opacity: 0 }, { opacity: 1, duration: 0.15 })
      .to(q("#q-clerk"), { y: 0, scale: 1, duration: 0.3, ease: "power1.out" })
      .set(q("#q-back"), { opacity: 0 })
      .set(q("#q-front"), { opacity: 1 })
      .set(q("#q-wave-arms, #q-wave-clip"), { opacity: 0 })
      .set(shrug ? q("#q-shrug-arms") : q("#q-present-arms, #q-present-page"), { opacity: 1 })
      .to(q("#q-door-open"), { opacity: 0, duration: 0.12 })
      .to(q("#q-door-shut"), { opacity: 1, duration: 0.12 }, "<")
      .to(q("#q-back-soon"), { opacity: 0, duration: 0.12 }, "<");
    return tl;
  }

  const scenes: Record<string, () => gsap.core.Timeline> = {
    // The Clerk takes the question, turns round and goes through the office door.
    clerk_away() {
      const tl = gsap.timeline({ paused: true });
      tl.add(reset)
        .set(q("#q-front"), { opacity: 0 })
        .set(q("#q-back"), { opacity: 1 })
        .to(q("#q-door-shut"), { opacity: 0, duration: 0.25 }, "+=0.15")
        .to(q("#q-door-open"), { opacity: 1, duration: 0.25 }, "<")
        .to(q("#q-clerk"), { y: -6, scale: 0.86, duration: 0.6, ease: "power1.in" })
        .to(q("#q-clerk"), { opacity: 0, duration: 0.3 }, "-=0.3")
        .addLabel("handoff") // gone through the door: he appears in the office straight away
        .to(q("#q-back-soon"), { opacity: 1, duration: 0.3 });
      return tl;
    },
    clerk_back: () => comeBack(false), // holding up the answer
    clerk_shrug: () => comeBack(true), // nothing was found
  };

  return { reset, scenes: scenes as unknown as Record<string, () => Timeline>, holds: {} };
}
