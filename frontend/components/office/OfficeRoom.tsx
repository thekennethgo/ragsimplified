"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import type { SceneQueue } from "../../lib/office/sceneQueue";
import type { SceneSet } from "../../lib/office/types";
import styles from "./OfficeRoom.module.css";

gsap.registerPlugin(useGSAP);

/** Loads a room SVG from /office/ (a static file we ship) and plays the queue's scenes in it. */
export default function OfficeRoom({
  src,
  label,
  build,
  queue,
  className,
}: {
  src: string;
  label: string;
  build: (root: SVGSVGElement) => SceneSet;
  queue: SceneQueue;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((response) =>
        response.ok ? response.text() : Promise.reject(new Error(String(response.status))),
      )
      .then((svg) => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
        setLoaded(true);
      })
      // The page still works with the speech bubbles and the step list if the art is missing.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [src]);

  useGSAP(
    () => {
      const svg = ref.current?.querySelector("svg");
      if (!loaded || !svg) return;
      const set = build(svg);
      set.reset();
      const unregister = queue.register(set);
      return unregister;
    },
    { scope: ref, dependencies: [loaded] },
  );

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <div ref={ref} className={styles.room} aria-hidden="true" />
      <span className={styles.caption}>{label}</span>
    </div>
  );
}
