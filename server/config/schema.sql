-- Users table (admin, agent, client roles)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'client')),
  phone VARCHAR(20),
  -- account status:
  --   'active'    - can log in normally
  --   'pending'   - agent self-registered, awaiting admin approval (cannot log in yet)
  --   'suspended' - deactivated by an admin (cannot log in)
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
  -- Two-factor authentication (TOTP), optional/opt-in for admin and agent accounts
  totp_secret TEXT,
  totp_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- National ID registry (seeded)
CREATE TABLE id_records (
  id SERIAL PRIMARY KEY,
  id_number VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(10),
  district VARCHAR(100),
  valid BOOLEAN DEFAULT true
);

-- Registered clients
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  id_number VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(10),
  phone VARCHAR(20),
  district VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  rejection_reason VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  elderly_assisted BOOLEAN DEFAULT false,
  -- KYC documents, stored as base64 data URLs (swap for object-storage URLs at scale)
  selfie_data TEXT,
  id_document_data TEXT,
  kyc_submitted_at TIMESTAMP DEFAULT NOW(),
  -- Mock KYC screening layers (see server/utils/mockScreening.js for what's simulated)
  face_match_score INTEGER,
  document_authenticity_score INTEGER,
  sanctions_flag BOOLEAN DEFAULT false,
  sanctions_match_name VARCHAR(200),
  sms_opt_in BOOLEAN DEFAULT true,
  email_opt_in BOOLEAN DEFAULT true,
  registered_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  terms_accepted_at TIMESTAMP,
  terms_version VARCHAR(20)
);

-- Betting activity (mock data for demo)
CREATE TABLE betting_activity (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  game VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  outcome VARCHAR(20) CHECK (outcome IN ('win', 'loss', 'pending')),
  placed_at TIMESTAMP DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  client_id INTEGER REFERENCES clients(id),
  action VARCHAR(100) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_client_id ON audit_logs(client_id);

-- ── Security & Access Control ─────────────────────────────────────────────
CREATE TABLE login_attempts (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100),
  ip_address VARCHAR(64),
  success BOOLEAN NOT NULL,
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE blocked_ips (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(64) UNIQUE NOT NULL,
  reason VARCHAR(255),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Workflow Automation ────────────────────────────────────────────────────
CREATE TABLE automation_rules (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  trigger_event VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  position_x INTEGER,
  position_y INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workflow_execution_log (
  id SERIAL PRIMARY KEY,
  rule_code VARCHAR(50),
  rule_name VARCHAR(150),
  client_id INTEGER REFERENCES clients(id),
  result_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Escalation: "if a client has been pending review longer than N hours, escalate"
CREATE TABLE escalation_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  condition_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  threshold_hours INTEGER NOT NULL DEFAULT 48,
  notify_role VARCHAR(20) NOT NULL DEFAULT 'admin',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE escalation_log (
  id SERIAL PRIMARY KEY,
  escalation_rule_id INTEGER REFERENCES escalation_rules(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  hours_pending NUMERIC,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(escalation_rule_id, client_id)
);

-- Approval chains: configurable multi-step sign-off for high-risk clients
CREATE TABLE approval_chains (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  trigger_condition VARCHAR(50) NOT NULL DEFAULT 'sanctions_or_elderly',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE approval_chain_steps (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER REFERENCES approval_chains(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  required_role VARCHAR(20) NOT NULL DEFAULT 'admin',
  label VARCHAR(150) NOT NULL,
  UNIQUE(chain_id, step_order)
);

CREATE TABLE approval_decisions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  chain_id INTEGER REFERENCES approval_chains(id),
  step_id INTEGER REFERENCES approval_chain_steps(id),
  decided_by INTEGER REFERENCES users(id),
  decision VARCHAR(20) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE clients ADD COLUMN approval_chain_id INTEGER REFERENCES approval_chains(id);
ALTER TABLE clients ADD COLUMN approval_step_index INTEGER NOT NULL DEFAULT 0;

-- External service integrations: outbound webhooks fired on rule execution
CREATE TABLE webhook_integrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  url TEXT NOT NULL,
  trigger_event VARCHAR(100) NOT NULL DEFAULT 'client_registered',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE webhook_delivery_log (
  id SERIAL PRIMARY KEY,
  webhook_id INTEGER REFERENCES webhook_integrations(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  status_code INTEGER,
  error_detail TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Client Communication ───────────────────────────────────────────────────
CREATE TABLE message_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('email', 'sms')),
  subject VARCHAR(200),
  body TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE message_log (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  sent_by INTEGER REFERENCES users(id),
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('email', 'sms')),
  template_id INTEGER REFERENCES message_templates(id),
  recipient VARCHAR(150) NOT NULL,
  subject VARCHAR(200),
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_detail VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed default automation rules
INSERT INTO automation_rules (code, name, description, trigger_event, action, enabled, sort_order, config) VALUES
  ('sanctions_escalate',  'Escalate sanctions/PEP matches',        'If a client name matches the sanctions/PEP watchlist, automatically flag the application for manual admin review instead of auto-verifying.', 'client_registered', 'flag_for_review', true, 1, '{}'),
  ('face_match_flag',     'Flag low selfie/ID match confidence',   'If the selfie-to-ID face match score falls below the threshold, flag the application for manual review rather than auto-approving.',           'client_registered', 'flag_for_review', true, 2, '{"threshold": 60}'),
  ('doc_authenticity_flag','Flag suspect ID documents',            'If the ID document authenticity check score falls below the threshold, flag the application for manual review.',                              'client_registered', 'flag_for_review', true, 3, '{"threshold": 50}'),
  ('registry_auto_verify','Auto-verify on registry match',         'If the ID number is found in the national registry and no other rule has flagged the application, verify it automatically without waiting on an admin.', 'client_registered', 'auto_verify', true, 4, '{}'),
  ('rejection_notify',   'Notify client on rejection',             'When an admin rejects a client''s KYC, automatically send them an email with the rejection reason and resubmission instructions.',                  'kyc_reviewed', 'send_notification', true, 5, '{}'),
  ('approval_notify',    'Notify client on approval',              'When a client is verified, automatically send a welcome/approval notification.',                                                                'kyc_reviewed', 'send_notification', true, 6, '{}');

-- Seed escalation rule
INSERT INTO escalation_rules (name, condition_status, threshold_hours, notify_role, enabled) VALUES
  ('Pending KYC review over 48h', 'pending', 48, 'admin', true);

-- Seed approval chain: high-risk clients require two admin sign-offs
INSERT INTO approval_chains (name, trigger_condition, enabled) VALUES
  ('High-risk client sign-off', 'sanctions_or_elderly', true);
INSERT INTO approval_chain_steps (chain_id, step_order, required_role, label)
  SELECT id, 1, 'admin', 'Initial admin review' FROM approval_chains WHERE name = 'High-risk client sign-off';
INSERT INTO approval_chain_steps (chain_id, step_order, required_role, label)
  SELECT id, 2, 'admin', 'Secondary sign-off' FROM approval_chains WHERE name = 'High-risk client sign-off';

-- Seed default message templates
INSERT INTO message_templates (name, channel, subject, body) VALUES
  ('KYC Approved',        'email', 'Your ServTech Rwanda account is verified',  'Hello {first_name}, your identity verification has been approved. You can now log in and use your account.'),
  ('KYC Rejected',        'email', 'Action needed on your ServTech Rwanda application', 'Hello {first_name}, we were unable to verify your application. Reason: {rejection_reason}. Please log in and resubmit your documents.'),
  ('Welcome SMS',         'sms',   NULL, 'Welcome to ServTech Rwanda, {first_name}! Your registration was received and is being reviewed.'),
  ('Verification Reminder','sms',  NULL, 'Hi {first_name}, your ServTech Rwanda verification is still pending. Please check your email for any required action.');
