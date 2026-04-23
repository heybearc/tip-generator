-- Migration 010: Generation audit logs
-- Structured per-draft audit trail for the full generation pipeline.
-- Events: task_start, pii_scrub, batch_start, rag_inject, claude_call, batch_complete, pii_restore, task_complete, task_failed

CREATE TABLE IF NOT EXISTS generation_logs (
    id          SERIAL PRIMARY KEY,
    draft_id    INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    event       VARCHAR(64) NOT NULL,           -- event type (see above)
    batch_index INTEGER,                        -- NULL for task-level events
    total_batches INTEGER,                      -- NULL for task-level events
    detail      JSONB NOT NULL DEFAULT '{}',    -- arbitrary event metadata
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_generation_logs_draft_id ON generation_logs(draft_id);
CREATE INDEX IF NOT EXISTS ix_generation_logs_created_at ON generation_logs(created_at);
