"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import HowWeTestIt from "../components/HowWeTestIt";
import { reducedMotion } from "../lib/office/motion";
import { FEATURED } from "../lib/shelves";
import styles from "./page.module.css";

const REPO = "https://github.com/thekennethgo/ragsimplified";

// Autoplays muted; visitors who prefer reduced motion get the same clip paused, with controls.
const HERO_CLIP = "/office/hero.mp4";

const EXAMPLES = FEATURED.slice(0, 3);

const STEPS: { id: string; name: string; text: string; clip: string | null }[] =
  [
    {
      id: "translator",
      name: "Translator",
      text: "Turns your question into numbers that capture its meaning.",
      clip: null,
    },
    {
      id: "scout",
      name: "Scout",
      text: "Searches the library by meaning and by words.",
      clip: null,
    },
    {
      id: "judge",
      name: "Judge",
      text: "Reads what was found and keeps only the best few.",
      clip: null,
    },
    {
      id: "storyteller",
      name: "Storyteller",
      text: "Writes the answer from those cards and cites each one.",
      clip: null,
    },
  ];

/** A muted looping clip when one exists and motion is welcome; the fallback (or nothing) otherwise. */
function Clip({
  src,
  poster,
  fallback = null,
}: {
  src: string | null;
  poster?: string;
  fallback?: React.ReactNode;
}) {
  const [calm, setCalm] = useState(false);
  useEffect(() => setCalm(reducedMotion()), []);
  if (!src || calm) return <>{fallback}</>;
  return <video src={src} poster={poster} autoPlay muted loop playsInline />;
}

const WHY = [
  { title: "Fewer made-up facts", text: "Answers come from real passages." },
  {
    title: "Always up to date",
    text: "Change a document and the answers change.",
  },
  { title: "You can check it", text: "Every claim links to its source." },
];

const BUILT = [
  {
    q: "How does it search?",
    a: "By meaning and by words at once; a reranker then keeps the best 5. If they aren't enough, it searches once more and adds up to 2.",
    link: "See the Scout",
    href: "/ask",
  },
  {
    q: "Can it make things up?",
    a: "It may only use the cards it found, and must cite each one.",
    link: "See the Storyteller",
    href: "/ask",
  },
  {
    q: "What if nothing fits?",
    a: "It says “I can't answer that from the available documents.” instead of guessing.",
    link: "Try it",
    href: "/ask",
  },
  {
    q: "What is it built with?",
    a: "Next.js, FastAPI, Postgres with pgvector, Voyage AI, Google Gemini 3.5 Flash Lite and Mercury Decide. Open source.",
    link: "GitHub",
    href: REPO,
  },
];

export default function Home() {
  return (
    <>
      <section aria-labelledby="hero-h" className={styles.hero}>
        <div className={styles.heroText}>
          <h1 id="hero-h">
            A language model that looks things up before it answers.
          </h1>
          <p>
            That&apos;s RAG. Watch an office of characters do it, step by step.
          </p>
          <div className={styles.buttons}>
            <Link href="/ask" className={styles.primary}>
              Ask a question
            </Link>
            <Link href="/upload" className={styles.secondary}>
              Upload your own document
            </Link>
          </div>
        </div>
        <figure className={styles.clip}>
          <Clip
            src={HERO_CLIP}
            fallback={<video src={HERO_CLIP} controls preload="metadata" />}
          />
          <figcaption>The office answering a question</figcaption>
        </figure>
      </section>

      <div className={styles.top}>
        <section
          aria-labelledby="what-h"
          className={`${styles.card} ${styles.column}`}
        >
          <h2 id="what-h">What is RAG?</h2>
          <p className={styles.lead}>
            <strong>Retrieval-augmented generation:</strong> find the right
            passages first, then answer only from them, with sources.
          </p>
          <ul className={styles.steps}>
            {STEPS.map((step) => (
              <li key={step.id} style={{ borderTopColor: `var(--${step.id})` }}>
                <Clip src={step.clip} />
                <strong>{step.name}</strong>
                <span>{step.text}</span>
              </li>
            ))}
          </ul>
          <p className={styles.small}>
            Perplexity and Microsoft 365 Copilot work this way.
          </p>
        </section>

        <section
          aria-labelledby="try-h"
          className={`${styles.card} ${styles.column}`}
        >
          <h2 id="try-h">Ask it something the internet doesn&apos;t know</h2>
          <p className={styles.lead}>
            RAG is easiest to judge on facts a model can&apos;t already know,
            because then every claim has to come from a cited card. The creator,
            Kenneth, added cards about himself, so ask about him.
          </p>
          <ul className={styles.examples}>
            {EXAMPLES.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <Link href="/ask" className={`${styles.primary} ${styles.tryLink}`}>
            Ask about Kenneth
          </Link>
        </section>
      </div>

      <div className={styles.pair}>
        <section
          aria-labelledby="why-h"
          className={`${styles.card} ${styles.column}`}
        >
          <h2 id="why-h">Why use RAG instead?</h2>
          <p className={styles.lead}>
            Models make things up, and it can cost real money:{" "}
            <a href="https://www.cbc.ca/news/canada/british-columbia/air-canada-chatbot-lawsuit-1.7116416">
              Air Canada paid out after its chatbot invented a refund policy
            </a>
            .
          </p>
          <ul className={styles.points}>
            {WHY.map((point) => (
              <li key={point.title}>
                <h3>{point.title}</h3>
                <p>{point.text}</p>
              </li>
            ))}
          </ul>
          <div className={styles.compare}>
            <p className={styles.small}>
              Same question, both ways:{" "}
              <strong>“How long can my question be here?”</strong>
            </p>
            <div className={styles.answerBox}>
              <div>
                <h3>Model on its own</h3>
                <span className={styles.bad}>No source</span>
              </div>
              <p>“Up to 4,000 characters.”</p>
              <p className={styles.small}>Confident, and made up.</p>
            </div>
            <div className={`${styles.answerBox} ${styles.withRag}`}>
              <div>
                <h3>With RAG</h3>
                <span className={styles.good}>1 source</span>
              </div>
              <p>
                “1,000 characters. <span className={styles.cite}>1</span>”
              </p>
              <p className={styles.small}>
                <span className={styles.mono}>[1]</span> Site FAQ · part 2 of 4:
                “…a question at most 1,000 characters…”
              </p>
            </div>
          </div>
          <p className={styles.small}>
            The catch: it&apos;s only as good as its library.
          </p>
        </section>

        <section
          aria-labelledby="built-h"
          className={`${styles.card} ${styles.column}`}
        >
          <h2 id="built-h">FAQ</h2>
          <ul className={styles.built}>
            {BUILT.map((row) => (
              <li key={row.q}>
                <h3>{row.q}</h3>
                <p>{row.a}</p>
                {row.href.startsWith("/") ? (
                  <Link href={row.href}>{row.link}</Link>
                ) : (
                  <a href={row.href}>{row.link}</a>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <HowWeTestIt />

      <footer className={styles.footer}>
        <a
          href={REPO}
          className={styles.github}
          aria-label="Source code on GitHub"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </footer>
    </>
  );
}
