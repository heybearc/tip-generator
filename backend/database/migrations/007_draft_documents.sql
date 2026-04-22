-- Migration 007: Multi-document support
-- Adds draft_documents junction table so a draft can reference any number of uploaded documents.
-- Existing discovery_document_id / service_order_document_id columns on drafts are preserved.

CREATE TABLE IF NOT EXISTS draft_documents (
    id          SERIAL PRIMARY KEY,
    draft_id    INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    role        VARCHAR(32) NOT NULL DEFAULT 'supplemental',  -- 'discovery' | 'service_order' | 'supplemental'
    position    INTEGER NOT NULL DEFAULT 0,                   -- ordering within role
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (draft_id, document_id)
);

CREATE INDEX IF NOT EXISTS ix_draft_documents_draft_id    ON draft_documents(draft_id);
CREATE INDEX IF NOT EXISTS ix_draft_documents_document_id ON draft_documents(document_id);
