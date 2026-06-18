INSERT INTO id_records (id_number, first_name, last_name, date_of_birth, gender, district) VALUES
('1199880012345678', 'Jean', 'Habimana', '1988-03-15', 'Male', 'Kigali'),
('1199920023456789', 'Marie', 'Uwimana', '1992-07-22', 'Female', 'Musanze'),
('1199750034567890', 'Pierre', 'Nkurunziza', '1975-11-08', 'Male', 'Huye'),
('1200000045678901', 'Diane', 'Mukamana', '2000-01-30', 'Female', 'Rubavu'),
('1199850056789012', 'Claude', 'Bizimana', '1985-05-12', 'Male', 'Nyagatare'),
('1199930067890123', 'Grace', 'Ingabire', '1993-09-04', 'Female', 'Kigali'),
('1199680078901234', 'Emmanuel', 'Nshimiyimana', '1968-12-19', 'Male', 'Muhanga'),
('1199970089012345', 'Solange', 'Uwitonze', '1997-04-27', 'Female', 'Rwamagana'),
('1199820090123456', 'Patrick', 'Hakizimana', '1982-08-03', 'Male', 'Kigali'),
('1199910001234567', 'Chantal', 'Murekatete', '1991-06-14', 'Female', 'Nyanza');

-- Passwords:
-- Admin: ServTech@Admin2026!
-- Agent: ServTech@Agent2026!
INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@servtech.rw', '$2a$10$5jd0iNPejQqEa94U0T/gSu7tMQHJU3pKePLQj.cJvHgcgUrWX46Fe', 'admin'),
('Agent One',  'agent@servtech.rw', '$2a$10$gXmNqlP2FZuRKARoYHKRheI/HaYgNVG9o30pufJZxt1m5RsgPZWMq', 'agent');
