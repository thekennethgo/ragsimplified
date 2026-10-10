import styles from "./AnimationToggle.module.css";

/** An On/Off switch for the office animations (off: no scenes, the progress still shows, straight away). */
export default function AnimationToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={styles.toggle}
      onClick={() => onChange(!on)}
    >
      Animations{" "}
      <span className={styles.track} aria-hidden="true">
        <span className={styles.knob} />
      </span>
      <span className={styles.state}>{on ? "On" : "Off"}</span>
    </button>
  );
}
