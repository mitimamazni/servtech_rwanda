-- Migration v7 — Terms & Conditions acceptance tracking (Module 1: Client Registration).
-- Safe to re-run: every statement checks for existence first.
-- Usage: psql "$DATABASE_URL" -f server/config/migration_v7.sql

ALTER TABLE clients ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20);
