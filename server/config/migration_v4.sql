-- Migration v4 — TOTP-based two-factor authentication for admin/agent accounts.
-- Safe to re-run. Usage: psql "$DATABASE_URL" -f server/config/migration_v4.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false;
