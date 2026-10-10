"use client";

import gsap from "gsap";
import { type RefObject, useEffect, useState } from "react";

type Pos = { left: number; top: number };

/** Where to put a bubble: above the character group `id` in the room inside `box`, in px from the box's top-left. */
export function useFollow(box: RefObject<HTMLElement | null>, id: string, on: boolean): Pos | null {
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    if (!on) {
      setPos(null);
      return;
    }
    const update = () => {
      const area = box.current;
      const el = area?.querySelector(`svg #${id}`);
      if (!area || !el) {
        setPos((now) => (now === null ? now : null));
        return;
      }
      const r = el.getBoundingClientRect();
      const b = area.getBoundingClientRect();
      const half = r.left + r.width / 2 - b.left;
      const left = Math.min(Math.max(half, b.width * 0.09), b.width * 0.91);
      const top = r.top - b.top;
      setPos((now) =>
        now && Math.abs(now.left - left) <= 0.5 && Math.abs(now.top - top) <= 0.5
          ? now
          : { left, top },
      );
    };
    update();
    gsap.ticker.add(update);
    return () => {
      gsap.ticker.remove(update);
    };
  }, [box, id, on]);

  return on ? pos : null;
}
