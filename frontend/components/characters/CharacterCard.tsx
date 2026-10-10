import type { ReactNode } from "react";

import type { Phase } from "../../lib/sceneState";
import styles from "./CharacterCard.module.css";
import Headshot from "./Headshot";

const LABELS: Record<Phase, string> = {
  waiting: "Waiting",
  working: "Working",
  done: "Done",
  error: "Error",
};

/** "cuts your text into cards" becomes "Cuts your text into cards." */
const sentence = (role: string) => `${role.charAt(0).toUpperCase()}${role.slice(1)}.`;

/** One character's tab: a headshot and speech bubble, this run's real results, and the technology under the hood. */
export default function CharacterCard({
  name,
  room,
  part,
  role,
  phase,
  plain,
  thisRun,
  tech,
  how,
  settings,
  extra,
}: {
  name: string;
  room: string;
  part: string;
  role: string;
  phase: Phase;
  plain: string;
  thisRun: ReactNode;
  tech: string[];
  how: string;
  settings: [string, string][];
  extra?: ReactNode;
}) {
  return (
    <article className={styles.card}>
      <div className={styles.intro}>
        <div className={styles.who}>
          <Headshot room={room} part={part} name={name} />
          <h3>{name}</h3>
        </div>
        <div className={styles.says}>
          <span className={`${styles.chip} ${styles[phase]}`}>{LABELS[phase]}</span>
          <p className={styles.role}>{sentence(role)}</p>
          <p>{plain}</p>
          <span className={styles.tail} aria-hidden="true" />
        </div>
      </div>

      <div className={styles.thisRun}>{thisRun}</div>

      <details className={styles.hood}>
        <summary>Under the hood</summary>
        <div className={styles.hoodBody}>
          <p>{how}</p>
          <ul className={styles.tech}>
            {tech.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <dl className={styles.settings}>
            {settings.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {extra}
        </div>
      </details>
    </article>
  );
}
