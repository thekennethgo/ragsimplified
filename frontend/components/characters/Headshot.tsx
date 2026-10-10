"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./Headshot.module.css";

/** The crop shared by every headshot: the head and shoulders of an 80 by 120 character. */
const CROP = "4 0 72 72";
/** Per-character crops where the shared one doesn't centre the head, keyed by the part prefix. */
const CROPS: Record<string, string> = {};

/** A character's head, cloned from the room art already on the page (resting pose); falls back to an initial. */
export default function Headshot({ room, part, name }: { room: string; part: string; name: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const clone = () => {
      const el = document.querySelector(`[data-room="${room}"] svg #${part}-flip`);
      const svg = svgRef.current;
      if (!el || !svg) return false;
      const copy = el.cloneNode(true) as SVGGElement;
      copy.removeAttribute("id");
      copy.removeAttribute("transform");
      copy.removeAttribute("style");
      copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      svg.replaceChildren(copy);
      setReady(true);
      return true;
    };
    if (clone()) return;
    const onReady = (event: Event) => {
      if ((event as CustomEvent).detail === room) clone();
    };
    window.addEventListener("office-ready", onReady);
    return () => window.removeEventListener("office-ready", onReady);
  }, [room, part]);

  return (
    <span className={styles.head}>
      <svg
        ref={svgRef}
        viewBox={CROPS[part] ?? CROP}
        aria-hidden="true"
        className={styles.svg}
        style={{ display: ready ? "block" : "none" }}
      />
      {!ready && <span aria-hidden="true">{name.charAt(0)}</span>}
    </span>
  );
}
