"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EVAL_CASES } from "../lib/evalCases";
import styles from "./HowWeTestIt.module.css";

const EVALS_URL = "https://github.com/thekennethgo/ragsimplified/tree/main/evals";

type Summary = {
  questions: number;
  groups: { id: string; passed: number; total: number }[];
};

/** The edge cases the evals check, with how many of each pass (from /eval-summary.json). */
export default function HowWeTestIt() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/eval-summary.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.groups)) setSummary(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="test-h" className={styles.section}>
      <h2 id="test-h">How we test it</h2>
      <p className={styles.lead}>
        Every change is checked against {summary ? summary.questions : "a set of"} questions,
        including these tricky ones.
      </p>
      <ul className={styles.cards}>
        {EVAL_CASES.map((card) => {
          const group = summary?.groups.find((g) => g.id === card.case);
          return (
            <li key={card.id} className={styles.card}>
              <h3>{card.title}</h3>
              <p>{card.why}</p>
              <div className={styles.footer}>
                {card.example ? (
                  <Link
                    href={`/ask?q=${encodeURIComponent(card.example)}`}
                    className={styles.try}
                  >
                    Try it
                  </Link>
                ) : (
                  <span className={styles.note}>Tested on a planted document in the test library</span>
                )}
                {group && (
                  <span className={styles.badge}>
                    {group.passed}/{group.total} passing
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className={styles.small}>
        <a href={EVALS_URL}>See all the evals</a>
      </p>
    </section>
  );
}
