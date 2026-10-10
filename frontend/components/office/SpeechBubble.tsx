import styles from "./SpeechBubble.module.css";

/** A character's speech bubble over a room, shown while the character works, centred above its head; at phone width it stacks under the room. */
export default function SpeechBubble({
  name,
  text,
  at,
}: {
  name: string;
  text: string;
  at: { left: number; top: number };
}) {
  return (
    <div
      className={`bubble ${styles.bubble}`}
      role="group"
      aria-label={name}
      style={{
        left: `${at.left}px`,
        top: `${at.top}px`,
        transform: "translate(-50%, calc(-100% - 10px))",
        width: "16%",
      }}
    >
      <p className={styles.text}>{text}</p>
      <span className="tail" style={{ left: "50%" }} />
    </div>
  );
}
