"use client";

import { useEffect, useState } from "react";

import { reducedMotion } from "./motion";
import { createSceneQueue, type SceneQueue } from "./sceneQueue";

/** One scene queue for the life of the page. */
export function useSceneQueue(): SceneQueue {
  const [queue] = useState(() => createSceneQueue({ reduced: reducedMotion }));
  useEffect(() => () => queue.clear(), [queue]);
  return queue;
}
