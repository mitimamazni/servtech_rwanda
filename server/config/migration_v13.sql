-- Migration v13 — Responsible gambling (self-exclusion).
-- A NULL self_exclusion_until means the client can bet normally, same as
-- every client before this migration. A future timestamp blocks betting
-- until that time, set by the client themselves (or lifted by an admin).
-- Safe to re-run. Usage: psql "$DATABASE_URL" -f server/config/migration_v13.sql

ALTER TABLE clients ADD COLUMN IF NOT EXISTS self_exclusion_until TIMESTAMP;
