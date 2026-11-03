# Kenneth Go: skills and where he used them

Each of Kenneth Go's technical skills, with the projects and work where he used it. For the projects themselves, see Kenneth's experience and projects document or his CV.

## Python and FastAPI

Kenneth wrote the backend of RAG Visualised (this site) in Python with FastAPI: the pipeline that chunks documents, embeds them, searches the library, reranks the results and writes the cited answer. He also wrote its evaluation suite of over 100 questions and its pytest tests in Python.

## TypeScript, React and Next.js

The frontend of RAG Visualised is built with Next.js, React and TypeScript, including the animated office, the interactive vector map and the clickable citations, with Vitest tests. Kenneth also used React for Whysper, for Catchup at UNIHACK 2026, and for the Jira Backlog Manager on Atlassian Forge, Jira's React-based app platform.

## JavaScript and Node.js

Kenneth built Whysper, an end-to-end encrypted chat application, with JavaScript, React and Node.js.

## Retrieval-augmented generation (RAG), embeddings and vector search

RAG Visualised is a full RAG pipeline that Kenneth built: documents are cut into chunks, embedded as vectors, and found with hybrid retrieval that combines pgvector similarity search with Postgres full-text search. A reranker narrows the top 20 candidates to the best 5 before a language model writes the answer. Kenneth also researched secure RAG architectures on confidential computing for Centra, his Peter Farrell Cup 2025 venture.

## LLM APIs

Kenneth used LLM APIs in RAG Visualised, which calls Gemini through an OpenAI-compatible client and also supports Claude, in Catchup, which gives LLM-powered event recommendations, and in the Jira Backlog Manager, which uses AI-generated summaries of backlog items.

## SQL, PostgreSQL and Supabase

RAG Visualised stores its library in PostgreSQL with the pgvector extension, hosted on Supabase. Kenneth also used Supabase for Whysper and for the real-time synchronisation of shared availability in Catchup.

## Security and cryptography

For Whysper, Kenneth implemented a hybrid RSA and AES cryptosystem from scratch: two users agree on a shared AES key through an RSA key exchange, so the server and the network only ever see ciphertext. He also studied Security Engineering at UNSW.

## Cloud, deployment and CI/CD

Kenneth is an AWS Certified Solutions Architect – Associate (August 2026). He deployed RAG Visualised with the frontend on Vercel and the backend on Render, and deployed Catchup on Render. In RAG Visualised, over 270 automated tests run in a GitHub Actions pipeline on every pull request.

## Agile, Scrum and leading a team

On the Jira Backlog Manager for an Atlassian client (February to April 2026), Kenneth was Scrum Master for a team of 5 engineers across 3 sprints. He ran sprint planning, standups and retrospectives and presented 3 demos to the client. At UNIHACK 2026 he was lead developer in a team of 3.

## Other languages

Kenneth also knows C++, Java, Rust and C from his Computer Science degree at UNSW, where his coursework included Data Structures and Algorithms, Operating Systems, Computer Networks and Object-Oriented Design.
