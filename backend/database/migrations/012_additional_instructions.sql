-- Migration 012: additional_instructions on drafts, instruction_presets on users

ALTER TABLE drafts ADD COLUMN IF NOT EXISTS additional_instructions TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS instruction_presets JSONB NOT NULL DEFAULT '[]'::jsonb;
