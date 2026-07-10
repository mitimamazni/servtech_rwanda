-- Migration v6 — records *why* a message failed (no email on file, not
-- configured, provider error), instead of a bare 'failed' status that gives
-- no way to tell "we have no email for this client" apart from "Gmail is
-- misconfigured" apart from "the send actually errored".
-- Usage: psql "$DATABASE_URL" -f server/config/migration_v6.sql

ALTER TABLE message_log ADD COLUMN IF NOT EXISTS error_detail VARCHAR(255);
