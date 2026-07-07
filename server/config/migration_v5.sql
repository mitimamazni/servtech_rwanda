-- Migration v5 — Security monitoring, KYC screening (mock), workflow automation,
-- and client communications. Safe to re-run.
-- Usage: psql "$DATABASE_URL" -f server/config/migration_v5.sql

-- ── Module 8: Security & Access Control ──────────────────────────────────
CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100),
  ip_address VARCHAR(64),
  success BOOLEAN NOT NULL,
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at);

CREATE TABLE IF NOT EXISTS blocked_ips (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(64) UNIQUE NOT NULL,
  reason VARCHAR(255),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Module 2: KYC hardening (mock screening layers) ──────────────────────
-- These are simulated for demo purposes — see server/utils/mockScreening.js
-- for exactly what's real vs. simulated, and what a production integration
-- (AWS Rekognition, a real sanctions/PEP database, etc.) would replace.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS face_match_score INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS document_authenticity_score INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sanctions_flag BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sanctions_match_name VARCHAR(200);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT true;

-- ── Module 4: Workflow Automation ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_rules (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,          -- stable identifier the app code checks against
  name VARCHAR(150) NOT NULL,
  description TEXT,
  trigger_event VARCHAR(100) NOT NULL,       -- e.g. 'client_registered', 'kyc_reviewed'
  action VARCHAR(100) NOT NULL,              -- e.g. 'auto_reject', 'flag_for_review', 'auto_verify'
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_execution_log (
  id SERIAL PRIMARY KEY,
  rule_code VARCHAR(50),
  rule_name VARCHAR(150),
  client_id INTEGER REFERENCES clients(id),
  result_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Module 9: Client Communication ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('email', 'sms')),
  subject VARCHAR(200),                      -- email only
  body TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_log (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  sent_by INTEGER REFERENCES users(id),
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('email', 'sms')),
  template_id INTEGER REFERENCES message_templates(id),
  recipient VARCHAR(150) NOT NULL,
  subject VARCHAR(200),
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,                -- 'sent' | 'failed' | 'skipped_opt_out'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed default automation rules (idempotent)
INSERT INTO automation_rules (code, name, description, trigger_event, action, enabled, sort_order) VALUES
  ('sanctions_escalate',  'Escalate sanctions/PEP matches',        'If a client name matches the sanctions/PEP watchlist, automatically flag the application for manual admin review instead of auto-verifying.', 'client_registered', 'flag_for_review', true, 1),
  ('face_match_flag',     'Flag low selfie/ID match confidence',   'If the selfie-to-ID face match score falls below 60%, flag the application for manual review rather than auto-approving.',                    'client_registered', 'flag_for_review', true, 2),
  ('doc_authenticity_flag','Flag suspect ID documents',            'If the ID document authenticity check score falls below 50%, flag the application for manual review.',                                       'client_registered', 'flag_for_review', true, 3),
  ('registry_auto_verify','Auto-verify on registry match',         'If the ID number is found in the national registry and no other rule has flagged the application, verify it automatically without waiting on an admin.', 'client_registered', 'auto_verify', true, 4),
  ('rejection_notify',   'Notify client on rejection',             'When an admin rejects a client''s KYC, automatically send them an email with the rejection reason and resubmission instructions.',                  'kyc_reviewed', 'send_notification', true, 5),
  ('approval_notify',    'Notify client on approval',              'When a client is verified, automatically send a welcome/approval notification.',                                                                'kyc_reviewed', 'send_notification', true, 6)
ON CONFLICT (code) DO NOTHING;

-- Seed default message templates (idempotent — only inserts if the table is empty)
INSERT INTO message_templates (name, channel, subject, body)
SELECT * FROM (VALUES
  ('KYC Approved',        'email', 'Your ServTech Rwanda account is verified',  'Hello {first_name}, your identity verification has been approved. You can now log in and use your account.'),
  ('KYC Rejected',        'email', 'Action needed on your ServTech Rwanda application', 'Hello {first_name}, we were unable to verify your application. Reason: {rejection_reason}. Please log in and resubmit your documents.'),
  ('Welcome SMS',         'sms',   NULL, 'Welcome to ServTech Rwanda, {first_name}! Your registration was received and is being reviewed.'),
  ('Verification Reminder','sms',  NULL, 'Hi {first_name}, your ServTech Rwanda verification is still pending. Please check your email for any required action.')
) AS t(name, channel, subject, body)
WHERE NOT EXISTS (SELECT 1 FROM message_templates);
