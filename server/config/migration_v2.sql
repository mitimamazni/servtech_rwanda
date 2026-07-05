-- Migration v2 — run this once against the existing (already deployed) database.
-- Safe to re-run: every statement checks for existence first.
-- Usage: psql "$DATABASE_URL" -f server/config/migration_v2.sql

-- 1. Account status on users (agent self-registration approval + deactivate/reactivate)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'active', 'suspended'));
UPDATE users SET status = 'active' WHERE status IS NULL;

-- 2. Client record extras: rejection reason, active flag, elderly-assisted flag
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS elderly_assisted BOOLEAN DEFAULT false;
UPDATE clients SET is_active = true WHERE is_active IS NULL;

-- 3. Fix the demo client password hash seeded incorrectly in v1
--    (bcrypt hash below corresponds to plaintext "ClientPass2026!")
UPDATE users
SET password = '$2b$10$vOay.Gdk6QVvuuabJlv5leUl/NdDtBe2lR0h7KRXiDUd9l.nL/FXu'
WHERE email IN ('jean@example.rw', 'marie@example.rw', 'patrick@example.rw')
  AND role = 'client';

-- 4. Extra seeded ID records to exercise age-gate testing (under 18 / over 80)
INSERT INTO id_records (id_number, first_name, last_name, date_of_birth, gender, district)
VALUES
  ('1201000112345678', 'Aine',   'Keza',      '2010-02-14', 'Gore', 'Kigali'),
  ('1201200198765432', 'Yves',   'Niyonzima', '2012-09-01', 'Gabo', 'Musanze'),
  ('1194000198765432', 'Vestine','Nyirahabimana', '1940-04-20', 'Gore', 'Huye'),
  ('1193800112349876', 'Anastase','Sibomana', '1938-11-11', 'Gabo', 'Nyanza')
ON CONFLICT (id_number) DO NOTHING;
