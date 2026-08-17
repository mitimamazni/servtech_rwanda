-- Migration v11 — Sportsbook (Phase 1 of "add an actual betting product").
-- Adds: matches to bet on, a client wallet balance, and links betting_activity
-- rows (already existed as mock data) to real matches/selections/odds so a bet
-- placed through the sportsbook is the same record the dashboard already reads.
-- Safe to re-run. Usage: psql "$DATABASE_URL" -f server/config/migration_v11.sql

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  sport VARCHAR(30) NOT NULL DEFAULT 'football',
  league VARCHAR(100),
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'finished', 'cancelled')),
  odds_home DECIMAL(6,2) NOT NULL,
  odds_draw DECIMAL(6,2),
  odds_away DECIMAL(6,2) NOT NULL,
  result VARCHAR(10) CHECK (result IN ('home', 'draw', 'away')),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Wallet balance clients bet from. Simulated top-ups only (no real payment
-- processing) — an agent/admin credits a client's wallet, same as the mock
-- betting_activity data that already existed before this migration.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 10000;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('topup', 'bet_stake', 'bet_payout', 'adjustment')),
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  reference VARCHAR(150),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Link betting_activity (existing mock table) to a real match + selection so
-- bets placed via the sportsbook show up on the same dashboards/pages that
-- already read from this table.
ALTER TABLE betting_activity ADD COLUMN IF NOT EXISTS match_id INTEGER REFERENCES matches(id);
ALTER TABLE betting_activity ADD COLUMN IF NOT EXISTS selection VARCHAR(10) CHECK (selection IN ('home', 'draw', 'away'));
ALTER TABLE betting_activity ADD COLUMN IF NOT EXISTS odds DECIMAL(6,2);
ALTER TABLE betting_activity ADD COLUMN IF NOT EXISTS potential_payout DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS idx_betting_activity_match_id ON betting_activity(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

-- Seed a handful of upcoming matches so the sportsbook isn't empty on first load.
INSERT INTO matches (sport, league, home_team, away_team, start_time, status, odds_home, odds_draw, odds_away)
SELECT * FROM (VALUES
  ('football', 'Rwanda Premier League', 'APR FC',        'Rayon Sports',   NOW() + INTERVAL '1 day',  'upcoming', 2.10, 3.20, 3.40),
  ('football', 'Rwanda Premier League', 'Police FC',     'AS Kigali',      NOW() + INTERVAL '2 days', 'upcoming', 1.90, 3.30, 3.90),
  ('football', 'English Premier League','Arsenal',       'Chelsea',        NOW() + INTERVAL '1 day',  'upcoming', 2.05, 3.40, 3.20),
  ('football', 'English Premier League','Man City',      'Liverpool',      NOW() + INTERVAL '3 days', 'upcoming', 2.20, 3.50, 3.00),
  ('football', 'La Liga',               'Real Madrid',   'Barcelona',      NOW() + INTERVAL '4 days', 'upcoming', 2.15, 3.60, 3.05),
  ('football', 'Champions League',      'Bayern Munich', 'PSG',            NOW() + INTERVAL '5 days', 'upcoming', 2.00, 3.70, 3.50),
  ('basketball','NBA',                  'Lakers',        'Celtics',        NOW() + INTERVAL '1 day',  'upcoming', 1.85, NULL, 1.95),
  ('basketball','NBA',                  'Warriors',      'Nuggets',        NOW() + INTERVAL '2 days', 'upcoming', 1.75, NULL, 2.05),
  ('boxing',    'World Title',          'Fighter A',     'Fighter B',      NOW() + INTERVAL '6 days', 'upcoming', 1.60, NULL, 2.30),
  ('football', 'Rwanda Premier League', 'Kiyovu Sports', 'Mukura Victory', NOW() + INTERVAL '6 hours','upcoming', 2.30, 3.10, 3.00)
) AS seed(sport, league, home_team, away_team, start_time, status, odds_home, odds_draw, odds_away)
WHERE NOT EXISTS (SELECT 1 FROM matches);
