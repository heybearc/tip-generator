-- Migration 006: Draft Collaboration
-- Creates draft_collaborators join table for Phase 2.3

CREATE TABLE IF NOT EXISTS draft_collaborators (
    id          SERIAL PRIMARY KEY,
    draft_id    INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (draft_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_draft_collaborators_draft_id ON draft_collaborators(draft_id);
CREATE INDEX IF NOT EXISTS ix_draft_collaborators_user_id  ON draft_collaborators(user_id);
