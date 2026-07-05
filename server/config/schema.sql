-- Users table (admin, agent, client roles)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'client')),
  phone VARCHAR(20),
<<<<<<< HEAD
  -- account status:
  --   'active'    - can log in normally
  --   'pending'   - agent self-registered, awaiting admin approval (cannot log in yet)
  --   'suspended' - deactivated by an admin (cannot log in)
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
=======
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
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
