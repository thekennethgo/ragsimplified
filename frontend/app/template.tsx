"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { type ReactNode, useRef } from "react";

import { reducedMotion } from "../lib/office/motion";

gsap.registerPlugin(useGSAP);

/** Fades each page in when you move between Home, Upload and Ask. */
export default function Template({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (reducedMotion()) return;
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
      );
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className="route">
      {children}
    </div>
  );
}
