-- Migration v8 — Client activity timeline (Module 3: Client Data Management).
-- Links audit log entries to the specific client they concern, so a
-- chronological "what happened to this client" view can be built by querying
-- audit_logs (registration/review/edit events), message_log (communications),
-- and workflow_execution_log (automation decisions) for one client_id.
-- Safe to re-run: every statement checks for existence first.
-- Usage: psql "$DATABASE_URL" -f server/config/migration_v8.sql

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_client_id ON audit_logs(client_id);
