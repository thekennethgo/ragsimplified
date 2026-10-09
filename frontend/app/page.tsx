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
  {
    title: "Far fewer hallucinations",
    text: "Answers come from real passages, which cuts made-up facts a lot. Not to zero.",
  },
  {
    title: "Up to date, no retraining",
    text: "Change a document and the answers change. Fine-tuning would mean training again.",
  },
  {
    title: "You can check it",
    text: "Every claim points to its source. Nothing on file? It says so.",
  },
];

const BUILT = [
  {
    q: "How big are the cards?",
    a: "[YOUR CARD SIZE AND OVERLAP, AND WHY THEY FIT YOUR DOCUMENTS].",
    link: "See the Chopper",
    href: "/upload",
  },
  {
    q: "How does it search?",
    a: "Two ways at once: by meaning (vector search) and by matching words (keyword search). A reranker then keeps the best 5.",
    link: "See the Scout",
    href: "/ask",
  },
  {
    q: "How do you know the search works?",
    a: "A set of test questions with known answers, scored on whether the right card was found and the citations are valid.",
    link: "See the evals",
    href: `${REPO}/tree/main/evals`,
  },
  {
    q: "How does it avoid making things up?",
    a: "The Judge keeps only cards that answer the question; the Storyteller may use only those and must cite each one.",
    link: "See the Judge",
    href: "/ask",
  },
  {
    q: "What if the right card isn't found?",
    a: "It says “nothing on file” instead of guessing. It doesn't rewrite the question and retry yet.",
    link: "Try it",
    href: "/ask",
  },
  {
    q: "How do you debug a wrong answer?",
    a: "Every step is shown on its own: the question's fingerprint, the finds, the ranking, the answer. Find the step where it went wrong.",
    link: "See the steps",
    href: "/ask",
  },
  {
    q: "What is it built with?",
    a: "Next.js, FastAPI, Postgres with pgvector, Voyage AI for fingerprints and reranking, and Claude Haiku for the answers. Open source: fork it for your own documents.",
    link: "GitHub",
    href: REPO,
  },
];

const FAQ = [
  { q: "Why did you build ragsimplified?", a: "[WHY YOU BUILT IT, IN YOUR WORDS]." },
  { q: "What are you working on now?", a: "[WHAT YOU'RE WORKING ON OR LOOKING FOR]." },
  { q: "How can I reach you?", a: "[HOW TO REACH YOU]." },
];

export default function Home() {
  return (
    <>
      <section aria-labelledby="hero-h" className={styles.hero}>
        <h1 id="hero-h">A language model that looks things up before it answers.</h1>
        <p>
          That&apos;s RAG. This site shows it step by step, as an office of characters: ask a
          question, or file your own text and watch it get used.
        </p>
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
          <p>New here? Ask me anything at the front desk.</p>
        </div>
      </section>

      <section aria-labelledby="what-h" className={`${styles.card} ${styles.what}`}>
        <div className={styles.whatLeft}>
          <h2 id="what-h">What is RAG?</h2>
          <p className={styles.lead}>
            <strong>Retrieval-augmented generation.</strong> A model on its own answers from memory,
            which can be out of date or simply wrong. With RAG it first finds the right passages in
            a library you trust, then answers only from those, and shows where each part came from.
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
          <p className={styles.small}>
            Perplexity, Microsoft 365 Copilot and Notion AI work this way.
          </p>
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
            <p className={styles.small}>
              Confident, and made up: it never saw this site&apos;s rules.
            </p>
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
          Models make things up, and it costs real money:{" "}
          <a href="https://www.cbc.ca/news/canada/british-columbia/air-canada-chatbot-lawsuit-1.7116416">
            Air Canada had to pay out after its chatbot invented a refund policy
          </a>{" "}
          (CBC News).
        </p>
        <ul className={styles.points}>
          {WHY.map((point) => (
            <li key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </li>
          ))}
        </ul>
        <p className={styles.small}>
          The catch: it&apos;s only as good as its library and its search. That&apos;s why the
          sources are always shown.
        </p>
      </section>

      <section aria-labelledby="built-h" className={`${styles.card} ${styles.column}`}>
        <div className={styles.column}>
          <h2 id="built-h">How this one is built</h2>
          <p className={styles.small}>
            The questions people ask about a RAG system, answered for this one.
          </p>
        </div>
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

      <section aria-labelledby="me-h" className={`${styles.card} ${styles.me}`}>
        <div className={styles.meTop}>
          <div className={styles.column}>
            <h2 id="me-h">About the creator</h2>
            <p className={styles.lead}>[YOUR NAME]: [ONE OR TWO SENTENCES ABOUT YOU].</p>
          </div>
          <div className={styles.askMe}>
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
            <span className={styles.small}>It answers from my own documents, with sources.</span>
          </div>
        </div>
        <div className={styles.faq}>
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>
                <svg
                  className={styles.chev}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
                {item.q}
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
