CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
    id bigserial PRIMARY KEY,
    title text NOT NULL,
    filename text NOT NULL,
    content_hash text NOT NULL UNIQUE,
    uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chunks (
    id bigserial PRIMARY KEY,
    document_id bigint NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    position integer NOT NULL,
    page integer,
    heading text,
    text text NOT NULL,
    embedding vector(1024) NOT NULL,
    fts tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
    UNIQUE (document_id, position)
);

CREATE INDEX chunks_fts_idx ON chunks USING gin (fts);
CREATE INDEX chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
