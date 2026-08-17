-- Migration v12 — Support ticket handling (Phase 2: "ticket handling", the
-- other thing ServTech does day-to-day for Winner besides QA).
-- Safe to re-run. Usage: psql "$DATABASE_URL" -f server/config/migration_v12.sql

CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  subject VARCHAR(200) NOT NULL,
  category VARCHAR(30) NOT NULL DEFAULT 'general' CHECK (category IN ('registration', 'betting', 'wallet', 'account', 'general')),
  priority VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_client_id ON support_tickets(client_id);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id),
  sender_role VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
