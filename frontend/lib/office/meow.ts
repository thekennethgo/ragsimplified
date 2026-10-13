import gsap from "gsap";

import { reducedMotion } from "./motion";

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Meow's idle loop: slow breathing, a tail flick every 6 to 10 seconds and a stretch about once a
 * minute. It ignores the scene queue and step events, and does not run under reduced motion.
 * Returns a function that stops it, or undefined when nothing was started.
 */
export function startMeow(root: Element): (() => void) | undefined {
  if (reducedMotion()) return undefined;
  const body = root.querySelector("#meow-body");
  const head = root.querySelector("#meow-head");
  const tail = root.querySelector("#meow-tail");
  if (!body) return undefined;

  const tweens: gsap.core.Animation[] = [];
  const calls: gsap.core.Tween[] = [];

  // A breath is 3 seconds: 1.5 s in, 1.5 s out.
  tweens.push(
    gsap.to(body, {
      scale: 1.025,
      transformOrigin: "50% 100%",
      duration: 1.5,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    }),
  );

  function later(seconds: number, run: () => void) {
    const call = gsap.delayedCall(seconds, run);
    calls.push(call);
  }

  function flick() {
    if (tail) {
      tweens.push(
        gsap.to(tail, {
          rotation: 22,
          transformOrigin: "0% 100%",
          duration: 0.25,
          ease: "sine.inOut",
          yoyo: true,
          repeat: 3,
        }),
      );
    }
    later(rand(6, 10), flick);
  }

  function stretch() {
    if (head) {
      tweens.push(
        gsap.to(head, {
          x: -4,
          y: 1,
          rotation: -8,
          transformOrigin: "100% 100%",
          duration: 1.4,
          ease: "sine.inOut",
          yoyo: true,
          repeat: 1,
        }),
      );
    }
    tweens.push(
      gsap.to(body, {
        skewX: -5,
        transformOrigin: "50% 100%",
        duration: 1.4,
        ease: "sine.inOut",
        yoyo: true,
        repeat: 1,
      }),
    );
    later(rand(55, 65), stretch);
  }

  later(rand(6, 10), flick);
  later(rand(55, 65), stretch);

  return () => {
    for (const call of calls) call.kill();
    for (const tween of tweens) tween.kill();
  };
}
