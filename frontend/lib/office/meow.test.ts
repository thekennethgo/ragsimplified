import gsap from "gsap";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { startMeow } from "./meow";

vi.mock("gsap", () => {
  const animation = () => ({ kill: vi.fn() });
  return {
    default: { to: vi.fn(animation), delayedCall: vi.fn(animation) },
  };
});

function room() {
  const root = document.createElement("div");
  root.innerHTML =
    '<g id="meow"><g id="meow-body"></g><g id="meow-head"></g><g id="meow-tail"></g></g>';
  return root;
}

function motion(reduce: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduce }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

test("breathes slowly: a 2 to 3 percent scale on the body, 3 seconds per breath", () => {
  motion(false);
  const root = room();
  startMeow(root);
  expect(gsap.to).toHaveBeenCalledWith(
    root.querySelector("#meow-body"),
    expect.objectContaining({ scale: 1.025, duration: 1.5, yoyo: true, repeat: -1 }),
  );
});

test("schedules a tail flick every 6 to 10 seconds and a stretch about once a minute", () => {
  motion(false);
  startMeow(room());
  const delays = vi.mocked(gsap.delayedCall).mock.calls.map(([seconds]) => seconds);
  expect(delays).toHaveLength(2);
  expect(delays[0]).toBeGreaterThanOrEqual(6);
  expect(delays[0]).toBeLessThanOrEqual(10);
  expect(delays[1]).toBeGreaterThanOrEqual(55);
  expect(delays[1]).toBeLessThanOrEqual(65);
});

test("does not run at all under reduced motion", () => {
  motion(true);
  expect(startMeow(room())).toBeUndefined();
  expect(gsap.to).not.toHaveBeenCalled();
  expect(gsap.delayedCall).not.toHaveBeenCalled();
});

test("stopping it kills the breath and the scheduled calls", () => {
  motion(false);
  const stop = startMeow(room())!;
  stop();
  for (const result of [
    ...vi.mocked(gsap.to).mock.results,
    ...vi.mocked(gsap.delayedCall).mock.results,
  ]) {
    expect((result.value as { kill: () => void }).kill).toHaveBeenCalled();
  }
});

test("does nothing when the room has no Meow", () => {
  motion(false);
  expect(startMeow(document.createElement("div"))).toBeUndefined();
});
