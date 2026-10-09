import type { StepEvent } from "./backend";
import type { SceneEvent } from "./office/types";

export type Phase = "waiting" | "working" | "done" | "error";

/** Each character's phase from the backend's step events; an error marks what was running. */
export function sceneReducer(s: Record<string, Phase>, e: StepEvent): Record<string, Phase> {
  if (e.step === "error") {
    return Object.fromEntries(
      Object.entries(s).map(([k, v]) => [k, v === "working" ? "error" : v]),
    );
  }
  return { ...s, [e.step]: e.status === "start" ? "working" : "done" };
}

/** Backend step event to scene events. */
export function toSceneEvents(e: StepEvent): SceneEvent[] {
  if (e.step === "error") return [{ name: "error" }];
  if (e.step === "judge" && e.status === "done") {
    const results = (e.data?.results ?? []) as { kept?: boolean }[];
    return [{ name: "judge_done", data: { nothing: !results.some((r) => r.kept) } }];
  }
  return [{ name: `${e.step}_${e.status}` }];
}
