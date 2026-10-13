import Link from "next/link";

import HowWeTestIt from "../components/HowWeTestIt";
import styles from "./page.module.css";

const REPO = "https://github.com/thekennethgo/ragsimplified";

const STEPS = [
  { who: "Translator + Scout", title: "1 · Find", text: "By meaning and by words." },
  { who: "Judge", title: "2 · Pick the best", text: "Keep the few that really answer it." },
  {
    who: "Storyteller",
    title: "3 · Answer with sources",
    text: "Only from those, each one numbered.",
  },
];

const WHY = [
  { title: "Fewer made-up facts", text: "Answers come from real passages." },
  { title: "Always up to date", text: "Change a document and the answers change." },
  { title: "You can check it", text: "Every claim links to its source." },
];

const BUILT = [
  {
    q: "How does it search?",
    a: "By meaning and by words at once; a reranker then keeps the best 5.",
    link: "See the Scout",
    href: "/ask",
  },
  {
    q: "Can it make things up?",
    a: "It may only use the cards it found, and must cite each one.",
    link: "See the Judge",
    href: "/ask",
  },
  {
    q: "What if nothing fits?",
    a: "It says “nothing on file” instead of guessing.",
    link: "Try it",
    href: "/ask",
  },
  {
    q: "What is it built with?",
    a: "Next.js, FastAPI, Postgres with pgvector, Voyage AI and Claude Haiku. Open source.",
    link: "GitHub",
    href: REPO,
  },
];

export default function Home() {
  return (
    <>
      <section aria-labelledby="hero-h" className={styles.hero}>
        <h1 id="hero-h">A language model that looks things up before it answers.</h1>
        <p>That&apos;s RAG. Watch an office of characters do it, step by step.</p>
        <div className={styles.buttons}>
          <Link href="/ask" className={styles.primary}>
            Ask a question
          </Link>
          <Link href="/upload" className={styles.secondary}>
            Add your own text
          </Link>
        </div>
      </section>

      <section aria-label="The break room" className={styles.breakRoom}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/office/break-room.svg"
          alt="The office break room: a corkboard titled Why RAG? with pinned notes joined by red string, the Clerk waving at it, a kitchen counter with a coffee machine and a small round table, with Meow, the office cat, asleep on the shelves, and a RAG.co rug on the floor."
          width={1280}
          height={300}
        />
        <div className={styles.clerk}>
          <p>Clerk</p>
          <p>New here? Ask me anything.</p>
        </div>
      </section>

      <section aria-labelledby="what-h" className={`${styles.card} ${styles.what}`}>
        <div className={styles.whatLeft}>
          <h2 id="what-h">What is RAG?</h2>
          <p className={styles.lead}>
            <strong>Retrieval-augmented generation:</strong> find the right passages first, then
            answer only from them, with sources.
          </p>
          <ol className={styles.steps}>
            {STEPS.map((step) => (
              <li key={step.title}>
                <span>{step.who}</span>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
          <p className={styles.small}>Perplexity and Microsoft 365 Copilot work this way.</p>
        </div>
        <div className={styles.whatRight}>
          <p className={styles.small}>
            Same question, both ways: <strong>“How many questions can I ask here per day?”</strong>
          </p>
          <div className={styles.answerBox}>
            <div>
              <h3>Model on its own</h3>
              <span className={styles.bad}>No source</span>
            </div>
            <p>“Up to 100 a day.”</p>
            <p className={styles.small}>Confident, and made up.</p>
          </div>
          <div className={`${styles.answerBox} ${styles.withRag}`}>
            <div>
              <h3>With RAG</h3>
              <span className={styles.good}>1 source</span>
            </div>
            <p>
              “20 a day. <span className={styles.cite}>1</span>”
            </p>
            <p className={styles.small}>
              <span className={styles.mono}>[1]</span> Site rules · card 3: “…20 questions per
              visitor each day…”
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="why-h" className={`${styles.card} ${styles.column}`}>
        <h2 id="why-h">Why not just ask the model?</h2>
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
        <p className={styles.small}>The catch: it&apos;s only as good as its library.</p>
      </section>

      <section aria-labelledby="built-h" className={`${styles.card} ${styles.column}`}>
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

      <HowWeTestIt />

      <footer className={styles.footer}>
        <a href={REPO} className={styles.github} aria-label="Source code on GitHub">
          <svg width="28" height="28" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </footer>
    </>
  );
}
