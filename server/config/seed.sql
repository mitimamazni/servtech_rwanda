-- ID records
INSERT INTO id_records (id_number, first_name, last_name, date_of_birth, gender, district) VALUES
('1198880012345678', 'Jean', 'Habimana', '1988-03-15', 'Gabo', 'Kigali'),
('1199220023456789', 'Marie', 'Uwimana', '1992-07-22', 'Gore', 'Musanze'),
('1197550034567890', 'Pierre', 'Nkurunziza', '1975-11-08', 'Gabo', 'Huye'),
('1200000045678901', 'Diane', 'Mukamana', '2000-01-30', 'Gore', 'Rubavu'),
('1198550056789012', 'Claude', 'Bizimana', '1985-05-12', 'Gabo', 'Nyagatare'),
('1199330067890123', 'Grace', 'Ingabire', '1993-09-04', 'Gore', 'Kigali'),
('1196880078901234', 'Emmanuel', 'Nshimiyimana', '1968-12-19', 'Gabo', 'Muhanga'),
('1199770089012345', 'Solange', 'Uwitonze', '1997-04-27', 'Gore', 'Rwamagana'),
('1198220090123456', 'Patrick', 'Hakizimana', '1982-08-03', 'Gabo', 'Kigali'),
('1199110001234567', 'Chantal', 'Murekatete', '1991-06-14', 'Gore', 'Nyanza'),
-- Under-18 records, for exercising the age-gate (rejected registrations)
('1201000112345678', 'Aine',    'Keza',          '2010-02-14', 'Gore', 'Kigali'),
('1201200198765432', 'Yves',    'Niyonzima',     '2012-09-01', 'Gabo', 'Musanze'),
-- Over-80 records, for exercising the agent-assisted identity confirmation flow
('1194000198765432', 'Vestine', 'Nyirahabimana', '1940-04-20', 'Gore', 'Huye'),
('1193800112349876', 'Anastase','Sibomana',      '1938-11-11', 'Gabo', 'Nyanza');

-- Users: Admin, Agent, and demo Clients
-- Admin: ServTech@Admin2026!
-- Agent: ServTech@Agent2026!
-- Client demo passwords: ClientPass2026!
INSERT INTO users (name, email, password, role, phone, status) VALUES
('Admin User',    'admin@servtech.rw',  '$2a$10$5jd0iNPejQqEa94U0T/gSu7tMQHJU3pKePLQj.cJvHgcgUrWX46Fe', 'admin', '0781000000', 'active'),
('Agent One',     'agent@servtech.rw',  '$2a$10$gXmNqlP2FZuRKARoYHKRheI/HaYgNVG9o30pufJZxt1m5RsgPZWMq', 'agent', '0782000000', 'active'),
('Jean Habimana', 'jean@example.rw',    '$2b$10$vOay.Gdk6QVvuuabJlv5leUl/NdDtBe2lR0h7KRXiDUd9l.nL/FXu', 'client', '0783000001', 'active'),
('Marie Uwimana', 'marie@example.rw',   '$2b$10$vOay.Gdk6QVvuuabJlv5leUl/NdDtBe2lR0h7KRXiDUd9l.nL/FXu', 'client', '0783000002', 'active'),
('Patrick Hakizimana', 'patrick@example.rw', '$2b$10$vOay.Gdk6QVvuuabJlv5leUl/NdDtBe2lR0h7KRXiDUd9l.nL/FXu', 'client', '0783000003', 'active');

-- Clients table (linked to user accounts)
INSERT INTO clients (user_id, id_number, first_name, last_name, date_of_birth, gender, phone, district, status, registered_by) VALUES
(3, '1198880012345678', 'Jean',    'Habimana',    '1988-03-15', 'Gabo',   '0783000001', 'Kigali', 'verified', 2),
(4, '1199220023456789', 'Marie',   'Uwimana',     '1992-07-22', 'Gore', '0783000002', 'Musanze','verified', 2),
(5, '1198220090123456', 'Patrick', 'Hakizimana',  '1982-08-03', 'Gabo',   '0783000003', 'Kigali', 'verified', 1);

-- Demo pending and rejected clients (no login account), so every status filter has example data
INSERT INTO clients (id_number, first_name, last_name, date_of_birth, gender, phone, district, status, rejection_reason, registered_by) VALUES
('1199990011122233', 'Eric', 'Mugisha', '1999-02-10', 'Gabo', '0788111222', 'Rwamagana', 'pending', NULL, 2),
('1201200198765432', 'Yves', 'Niyonzima', '2012-09-01', 'Gabo', '0788111333', 'Musanze', 'rejected', 'Under 18 - minimum registration age not met', NULL);

-- Betting activity mock data
INSERT INTO betting_activity (client_id, game, amount, outcome, placed_at) VALUES
(1, 'Arsenal vs Chelsea',        5000,  'win',     NOW() - INTERVAL '1 day'),
(1, 'Barcelona vs Real Madrid',  3000,  'loss',    NOW() - INTERVAL '2 days'),
(1, 'Man City vs Liverpool',     10000, 'win',     NOW() - INTERVAL '3 days'),
(1, 'Rwanda vs Uganda',          2000,  'pending', NOW() - INTERVAL '4 hours'),
(1, 'PSG vs Bayern Munich',      7500,  'loss',    NOW() - INTERVAL '5 days'),
(1, 'Inter vs Juventus',         4000,  'win',     NOW() - INTERVAL '6 days'),
(1, 'Lakers vs Bulls',           3500,  'loss',    NOW() - INTERVAL '7 days'),
(2, 'Arsenal vs Chelsea',        2000,  'win',     NOW() - INTERVAL '1 day'),
(2, 'Barcelona vs Real Madrid',  5000,  'win',     NOW() - INTERVAL '3 days'),
(2, 'Man City vs Liverpool',     1500,  'loss',    NOW() - INTERVAL '4 days'),
(2, 'Rwanda vs Uganda',          3000,  'pending', NOW() - INTERVAL '2 hours'),
(2, 'PSG vs Bayern Munich',      4500,  'win',     NOW() - INTERVAL '6 days'),
(3, 'Arsenal vs Chelsea',        8000,  'win',     NOW() - INTERVAL '2 days'),
(3, 'Barcelona vs Real Madrid',  6000,  'loss',    NOW() - INTERVAL '3 days'),
(3, 'Man City vs Liverpool',     2500,  'win',     NOW() - INTERVAL '5 days'),
(3, 'Rwanda vs Uganda',          5000,  'pending', NOW() - INTERVAL '1 hour'),
(3, 'Kaizer Chiefs vs Sundowns', 3000,  'loss',    NOW() - INTERVAL '7 days');
