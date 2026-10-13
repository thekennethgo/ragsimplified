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
  if (e.step === "second_look") {
    // The Judge carries the second look: checking whether the cards are enough, then done again.
    // (With a query the Judge and the Clerk then speak during the rewrite scene.)
    return { ...s, judge: e.status === "start" ? "working" : "done" };
  }
  return { ...s, [e.step]: e.status === "start" ? "working" : "done" };
}

/** Backend step event to scene events. */
export function toSceneEvents(e: StepEvent): SceneEvent[] {
  if (e.step === "error") return [{ name: "error" }];
  if (e.step === "judge" && e.status === "done") {
    // The second round's verdict never means "nothing found": the first round kept something.
    // With a final check to come, the Judge only rules; the check then hands over or tells the Clerk.
    if (e.data?.round === 2) {
      if (e.data?.check === true) return [{ name: "judge_ruled" }];
      return [{ name: "judge_done", data: { nothing: false } }];
    }
    const results = (e.data?.results ?? []) as { kept?: boolean }[];
    const nothing = !results.some((r) => r.kept);
    // Rules, but keeps the cards: the second look decides whether they go to the Storyteller.
    if (e.data?.second_look === true && !nothing) return [{ name: "judge_ruled" }];
    return [{ name: "judge_done", data: { nothing } }];
  }
  if (e.step === "second_look" && e.status === "done") {
    // Nothing on file: the Judge tells the Clerk instead of handing the cards to the Storyteller.
    if (e.data?.nothing === true) return [{ name: "second_look_nothing" }];
    const query = e.data?.query;
    // A query: the Judge has the Clerk rewrite the board. None: the sources are enough, hand over.
    if (typeof query === "string" && query) {
      return [{ name: "second_look_rewrite", data: { query } }];
    }
    return [{ name: "judge_handover" }];
  }
  return [{ name: `${e.step}_${e.status}` }];
}
