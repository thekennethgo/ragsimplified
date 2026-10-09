import type { Phase } from "../../lib/sceneState";
import styles from "./SpeechBubble.module.css";

const STATUS: Record<Phase, string> = {
  waiting: "Waiting",
  working: "Working",
  done: "Done",
  error: "Error",
};

export type Anchor = { left: number; top?: number; bottom?: number; tail?: number };

/** A character's speech bubble over a room; at phone width it stacks under the room. */
export default function SpeechBubble({
  name,
  phase,
  text,
  anchor,
  width = 14,
}: {
  name: string;
  phase: Phase;
  text: string;
  anchor: Anchor;
  width?: number;
}) {
  return (
    <div
      className={`bubble ${styles.bubble}`}
      role="group"
      aria-label={name}
      style={{
        left: `${anchor.left}%`,
        top: anchor.top === undefined ? undefined : `${anchor.top}%`,
        bottom: anchor.bottom === undefined ? undefined : `${anchor.bottom}%`,
        width: `${width}%`,
      }}
    >
      <div className={styles.head}>
        <span className={styles.name}>{name}</span>
        <span className={`${styles.chip} ${styles[phase]}`}>{STATUS[phase]}</span>
      </div>
      <p className={styles.text}>{text}</p>
      <span className="tail" style={{ left: `${anchor.tail ?? 50}%` }} />
    </div>
  );
}
