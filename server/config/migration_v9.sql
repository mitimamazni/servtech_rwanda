-- Migration v9 — Workflow Automation (Module 4).
-- Adds: configurable per-rule parameters + canvas position (visual designer),
-- escalation rules, approval chains for high-risk clients, and outbound
-- webhook integrations. Safe to re-run: every statement checks first.
-- Usage: psql "$DATABASE_URL" -f server/config/migration_v9.sql

-- ── Configurable rule parameters + visual designer layout ──────────────────
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS position_x INTEGER;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS position_y INTEGER;

-- Backfill the thresholds that used to be hardcoded in workflowEngine.js so
-- existing rules keep behaving exactly the same after this migration.
UPDATE automation_rules SET config = '{"threshold": 60}'::jsonb
  WHERE code = 'face_match_flag' AND (config IS NULL OR config = '{}'::jsonb);
UPDATE automation_rules SET config = '{"threshold": 50}'::jsonb
  WHERE code = 'doc_authenticity_flag' AND (config IS NULL OR config = '{}'::jsonb);

-- ── Escalation rules: "if pending review longer than N hours, escalate" ────
CREATE TABLE IF NOT EXISTS escalation_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  condition_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  threshold_hours INTEGER NOT NULL DEFAULT 48,
  notify_role VARCHAR(20) NOT NULL DEFAULT 'admin',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escalation_log (
  id SERIAL PRIMARY KEY,
  escalation_rule_id INTEGER REFERENCES escalation_rules(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  hours_pending NUMERIC,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(escalation_rule_id, client_id)
);

INSERT INTO escalation_rules (name, condition_status, threshold_hours, notify_role, enabled)
SELECT 'Pending KYC review over 48h', 'pending', 48, 'admin', true
WHERE NOT EXISTS (SELECT 1 FROM escalation_rules WHERE name = 'Pending KYC review over 48h');

-- ── Approval chains: configurable multi-step sign-off for high-risk clients ─
CREATE TABLE IF NOT EXISTS approval_chains (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  trigger_condition VARCHAR(50) NOT NULL DEFAULT 'sanctions_or_elderly',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_chain_steps (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER REFERENCES approval_chains(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  required_role VARCHAR(20) NOT NULL DEFAULT 'admin',
  label VARCHAR(150) NOT NULL,
  UNIQUE(chain_id, step_order)
);

CREATE TABLE IF NOT EXISTS approval_decisions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  chain_id INTEGER REFERENCES approval_chains(id),
  step_id INTEGER REFERENCES approval_chain_steps(id),
  decided_by INTEGER REFERENCES users(id),
  decision VARCHAR(20) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS approval_chain_id INTEGER REFERENCES approval_chains(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS approval_step_index INTEGER NOT NULL DEFAULT 0;

INSERT INTO approval_chains (name, trigger_condition, enabled)
SELECT 'High-risk client sign-off', 'sanctions_or_elderly', true
WHERE NOT EXISTS (SELECT 1 FROM approval_chains WHERE name = 'High-risk client sign-off');

INSERT INTO approval_chain_steps (chain_id, step_order, required_role, label)
SELECT c.id, 1, 'admin', 'Initial admin review'
FROM approval_chains c WHERE c.name = 'High-risk client sign-off'
  AND NOT EXISTS (SELECT 1 FROM approval_chain_steps s WHERE s.chain_id = c.id AND s.step_order = 1);

INSERT INTO approval_chain_steps (chain_id, step_order, required_role, label)
SELECT c.id, 2, 'admin', 'Secondary sign-off'
FROM approval_chains c WHERE c.name = 'High-risk client sign-off'
  AND NOT EXISTS (SELECT 1 FROM approval_chain_steps s WHERE s.chain_id = c.id AND s.step_order = 2);

-- ── External service integrations: outbound webhooks on rule execution ─────
CREATE TABLE IF NOT EXISTS webhook_integrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  url TEXT NOT NULL,
  trigger_event VARCHAR(100) NOT NULL DEFAULT 'client_registered',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_delivery_log (
  id SERIAL PRIMARY KEY,
  webhook_id INTEGER REFERENCES webhook_integrations(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  status_code INTEGER,
  error_detail TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
