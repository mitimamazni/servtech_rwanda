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
  registered_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
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
  action VARCHAR(100) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────────────────
-- This project is hosted on Supabase, which auto-exposes every public-schema
-- table over a REST API to the anon/authenticated keys unless RLS blocks it.
-- The backend (server/config/db.js) connects directly as the `postgres`
-- superuser via DATABASE_URL, so it bypasses RLS entirely and is unaffected —
-- this only closes off Supabase's auto-generated API, which this app doesn't use.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE betting_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_only ON users
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_only ON id_records
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_only ON clients
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_only ON betting_activity
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_role_only ON audit_logs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
