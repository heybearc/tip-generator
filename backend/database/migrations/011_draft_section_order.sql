-- Migration 011: Per-draft section ordering and visibility
-- Allows users to reorder sections and hide them from exports without deleting content.

CREATE TABLE IF NOT EXISTS draft_section_order (
    id          SERIAL PRIMARY KEY,
    draft_id    INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    section_key TEXT NOT NULL,              -- matches key in draft.sections JSON
    position    INTEGER NOT NULL DEFAULT 0, -- lower = earlier in doc
    visible     BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (draft_id, section_key)
);

CREATE INDEX IF NOT EXISTS ix_draft_section_order_draft_id ON draft_section_order(draft_id);
