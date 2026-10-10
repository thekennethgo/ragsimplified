"use client";

import { useEffect, useState } from "react";

import { reducedMotion } from "./motion";
import { createSceneQueue, type SceneQueue } from "./sceneQueue";

/** One scene queue for the life of the page. */
export function useSceneQueue(skip: () => boolean): SceneQueue {
  const [queue] = useState(() => createSceneQueue({ reduced: reducedMotion, skip, gapMs: 800 }));
  useEffect(() => () => queue.clear(), [queue]);
  return queue;
}
