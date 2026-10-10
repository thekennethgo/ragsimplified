"use client";

import { useEffect, useState } from "react";

const KEY = "ragsimplified.animations";

/** Whether the visitor wants to watch the office play out (remembered in this browser). */
export function useAnimationsSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "off") setOn(false);
    } catch {}
  }, []);
  const set = (next: boolean) => {
    setOn(next);
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {}
  };
  return [on, set];
}
