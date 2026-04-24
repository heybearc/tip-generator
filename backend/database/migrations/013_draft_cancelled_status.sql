-- Migration 013: add 'cancelled' to draftstatus enum
ALTER TYPE draftstatus ADD VALUE IF NOT EXISTS 'cancelled';
