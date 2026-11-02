export type SceneEvent = { name: string; data?: Record<string, unknown> };

/** The part of a GSAP timeline the queue uses (so tests can pass fakes). */
export type Timeline = {
  duration(): number;
  play(): unknown;
  progress(p: number): unknown;
  kill(): void;
  labels: Record<string, number>;
  call(fn: () => void, args: null, pos: number): unknown;
  eventCallback(type: "onComplete", fn?: () => void): unknown;
};

export type SceneSet = {
  reset(): void;
  scenes: Record<string, (data?: Record<string, unknown>) => Timeline>;
  /** A looping "still working" tween started when a scene completes, keyed by character. */
  holds: Record<string, { kill(): void }>;
};

/** UI updates tied to a scene: onStart when it starts, onEnd when the queue moves past it. */
export type SceneHooks = { onStart?: () => void; onEnd?: () => void };
