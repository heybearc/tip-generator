-- Migration 009b: Add scrub_pii column to drafts table
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS scrub_pii BOOLEAN NOT NULL DEFAULT FALSE;
