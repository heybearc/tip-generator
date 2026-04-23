-- Migration 009: PII pseudonymization maps per draft
-- Stores token→original_value mapping used to scrub before Claude and restore after.

CREATE TABLE IF NOT EXISTS draft_pii_maps (
    id          SERIAL PRIMARY KEY,
    draft_id    INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    pii_map     JSONB NOT NULL DEFAULT '{}',   -- {"{{IP_1}}": "192.168.1.10", ...}
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (draft_id)
);

CREATE INDEX IF NOT EXISTS ix_draft_pii_maps_draft_id ON draft_pii_maps(draft_id);
