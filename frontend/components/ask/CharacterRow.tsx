import type { ReactNode } from "react";

import type { StepState } from "../../lib/ask";

/** A placeholder for a character: a labelled box showing its state. Real art replaces it later. */
export function Character({
  name,
  state,
  detail,
  children,
}: {
  name: string;
  state: StepState;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`character character-${state}`} role="group" aria-label={name}>
      {children}
      <strong>{name}</strong>
      <span className="character-state">{state}</span>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export type SceneState = {
  translator: StepState;
  scout: StepState;
  judge: StepState;
  storyteller: StepState;
  scoutDetail?: string;
  judgeDetail?: string;
};

/** The cast side by side, with the Archivist and the Scout standing by in a mock library. */
export function CharacterRow({
  state,
  above,
}: {
  state: SceneState;
  above: { translator: ReactNode; storyteller: ReactNode };
}) {
  return (
    <div className="scene" aria-label="Characters">
      <div className="slot">
        {above.translator}
        <Character name="Translator" state={state.translator} />
      </div>
      <div className="library" role="group" aria-label="Library">
        <span className="library-label">Library</span>
        <div className="library-cast">
          <Character name="Archivist" state="waiting" detail="standing by" />
          <Character name="Scout" state={state.scout} detail={state.scoutDetail} />
        </div>
      </div>
      <div className="slot">
        <Character name="Judge" state={state.judge} detail={state.judgeDetail} />
      </div>
      <div className="slot">
        {above.storyteller}
        <Character name="Storyteller" state={state.storyteller} />
      </div>
    </div>
  );
}
