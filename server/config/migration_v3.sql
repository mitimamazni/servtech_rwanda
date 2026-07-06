-- Migration v3 — KYC document capture (selfie + ID document image for manual review).
-- Safe to re-run: every statement checks for existence first.
-- Usage: psql "$DATABASE_URL" -f server/config/migration_v3.sql

-- Store as base64 data URLs (text). For production scale, swap these for
-- object-storage URLs (S3/R2/etc.) instead of storing image bytes in Postgres.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS selfie_data TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_document_data TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMP DEFAULT NOW();
