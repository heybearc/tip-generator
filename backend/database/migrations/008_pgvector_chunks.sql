-- Migration 008: pgvector embeddings + section-chunk library
-- Requires: CREATE EXTENSION vector; (run as superuser before applying)

-- 1. Add embedding column to library_documents (whole-document embedding for fallback search)
ALTER TABLE library_documents
    ADD COLUMN IF NOT EXISTS embedding_vec vector(1536);

CREATE INDEX IF NOT EXISTS ix_library_documents_embedding
    ON library_documents USING ivfflat (embedding_vec vector_cosine_ops)
    WITH (lists = 10);

-- 2. Section-level chunk table
CREATE TABLE IF NOT EXISTS library_chunks (
    id              SERIAL PRIMARY KEY,
    library_doc_id  INTEGER NOT NULL REFERENCES library_documents(id) ON DELETE CASCADE,
    section_title   TEXT NOT NULL,          -- e.g. "Implementation Details"
    section_level   INTEGER NOT NULL DEFAULT 1,
    content         TEXT NOT NULL,
    embedding_vec   vector(1536),
    tech_tags       TEXT[] DEFAULT '{}',    -- e.g. '{Azure AD, M365}'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_library_chunks_library_doc_id
    ON library_chunks(library_doc_id);

CREATE INDEX IF NOT EXISTS ix_library_chunks_embedding
    ON library_chunks USING ivfflat (embedding_vec vector_cosine_ops)
    WITH (lists = 10);

CREATE INDEX IF NOT EXISTS ix_library_chunks_tech_tags
    ON library_chunks USING gin(tech_tags);
