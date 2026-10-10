import Link from "next/link";

import styles from "./page.module.css";

const REPO = "https://github.com/thekennethgo/ragsimplified";
const ABOUT_QUESTION = "Who built ragsimplified, and what else have they worked on?";

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
    q: "Does the search work?",
    a: "It's scored on test questions with known answers.",
    link: "See the evals",
    href: `${REPO}/tree/main/evals`,
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
          alt="The office break room: a corkboard titled Why RAG? with pinned notes joined by red string, the Clerk waving at it, a kitchen counter with a coffee machine and a small round table."
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
        <h2 id="built-h">How this one is built</h2>
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

      <section aria-label="About the creator" className={styles.creator}>
        <p>
          <strong>[YOUR NAME]</strong> · [ONE-LINE BIO]
        </p>
        <Link href={`/ask?q=${encodeURIComponent(ABOUT_QUESTION)}`} className={styles.primary}>
          Ask the office about me
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </Link>
        <a href={REPO}>GitHub</a>
      </section>
    </>
  );
}
