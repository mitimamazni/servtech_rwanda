-- Migration v10 — Expiring IP blocks (Security & Access Control hardening).
-- A NULL expires_at means a permanent block, same as all blocks behaved
-- before this migration — existing rows are unaffected.
-- Safe to re-run. Usage: psql "$DATABASE_URL" -f server/config/migration_v10.sql

ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
