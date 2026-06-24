const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { sendClientWelcomeEmail } = require('../utils/email');

// Client self-registration
exports.selfRegister = async (req, res) => {
  const { id_number, first_name, last_name, date_of_birth, gender, phone, district, email } = req.body;

  try {
    // Age check from ID number format: positions 1-4 = birth year
    const birthYear = parseInt(id_number.substring(1, 5));
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;
    if (age < 18) {
      return res.status(400).json({
        message: 'Registration denied. You must be 18 or older to register.',
        underAge: true,
      });
    }

    // Duplicate client check
    const existingClient = await pool.query('SELECT id FROM clients WHERE id_number = $1', [id_number]);
    if (existingClient.rows.length > 0) {
      return res.status(400).json({
        message: 'This ID is already registered on ServTech Rwanda.',
        duplicate: true,
      });
    }

    // Duplicate email check
    const existingEmail = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ message: 'This email address is already in use.' });
    }

    // Verify against registry
    const idCheck = await pool.query('SELECT id FROM id_records WHERE id_number = $1 AND valid = true', [id_number]);
    const status = idCheck.rows.length > 0 ? 'verified' : 'pending';

    // Generate password
    const rawPassword = `ST@${first_name.charAt(0).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(10 + Math.random() * 90)}!`;
    const hashed = await bcrypt.hash(rawPassword, 10);

    // Create user account
    const userResult = await pool.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [`${first_name} ${last_name}`, email, hashed, 'client', phone]
    );
    const userId = userResult.rows[0].id;

    // Create client record
    const clientResult = await pool.query(
      `INSERT INTO clients (user_id, id_number, first_name, last_name, date_of_birth, gender, phone, district, status, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [userId, id_number, first_name, last_name, date_of_birth, gender, phone, district, status, userId]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [userId, 'SELF_REGISTER', `Client self-registered: ${id_number} - status: ${status}`]
    );

    // Send welcome email
    await sendClientWelcomeEmail({ name: `${first_name} ${last_name}`, email, password: rawPassword });

    res.status(201).json({
      message: 'Registration successful! Check your email for login credentials.',
      client: clientResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get client's own profile + betting activity
exports.getClientDashboard = async (req, res) => {
  try {
    const clientResult = await pool.query(
      `SELECT c.*, u.email FROM clients c
       JOIN users u ON c.user_id = u.id
       WHERE c.user_id = $1`,
      [req.user.id]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ message: 'Client profile not found' });
    }

    const client = clientResult.rows[0];

    const bettingResult = await pool.query(
      `SELECT * FROM betting_activity WHERE client_id = $1 ORDER BY placed_at DESC LIMIT 20`,
      [client.id]
    );

    const statsResult = await pool.query(
      `SELECT
        COUNT(*) as total_bets,
        SUM(amount) as total_wagered,
        SUM(CASE WHEN outcome = 'win' THEN amount ELSE 0 END) as total_won,
        COUNT(CASE WHEN outcome = 'win' THEN 1 END) as wins,
        COUNT(CASE WHEN outcome = 'loss' THEN 1 END) as losses,
        COUNT(CASE WHEN outcome = 'pending' THEN 1 END) as pending
       FROM betting_activity WHERE client_id = $1`,
      [client.id]
    );

    res.json({
      client,
      bets: bettingResult.rows,
      stats: statsResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: get any client's betting activity
exports.getClientActivity = async (req, res) => {
  const { clientId } = req.params;
  try {
    const clientResult = await pool.query(
      `SELECT c.*, u.email, u2.name as agent_name, u2.phone as agent_phone
       FROM clients c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN users u2 ON c.registered_by = u2.id
       WHERE c.id = $1`,
      [clientId]
    );
    if (clientResult.rows.length === 0) return res.status(404).json({ message: 'Client not found' });

    const bettingResult = await pool.query(
      'SELECT * FROM betting_activity WHERE client_id = $1 ORDER BY placed_at DESC',
      [clientId]
    );

    const statsResult = await pool.query(
      `SELECT COUNT(*) as total_bets, SUM(amount) as total_wagered,
              COUNT(CASE WHEN outcome='win' THEN 1 END) as wins,
              COUNT(CASE WHEN outcome='loss' THEN 1 END) as losses,
              COUNT(CASE WHEN outcome='pending' THEN 1 END) as pending
       FROM betting_activity WHERE client_id = $1`,
      [clientId]
    );

    res.json({ client: clientResult.rows[0], bets: bettingResult.rows, stats: statsResult.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
