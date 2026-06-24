const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { sendAgentWelcomeEmail } = require('../utils/email');

// GET all agents
exports.getAgents = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, u.created_at,
             COUNT(c.id) AS clients_registered
      FROM users u
      LEFT JOIN clients c ON c.registered_by = u.id
      WHERE u.role = 'agent'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// CREATE agent
exports.createAgent = async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Email already in use' });

    // Generate a strong temp password
    const rawPassword = `ST@${Math.random().toString(36).slice(2, 8).toUpperCase()}${Math.floor(100 + Math.random() * 900)}!`;
    const hashed = await bcrypt.hash(rawPassword, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, created_at',
      [name, email, hashed, 'agent', phone || null]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CREATE_AGENT', `Admin created agent: ${email}`]
    );

    // Send welcome email with credentials
    await sendAgentWelcomeEmail({ name, email, password: rawPassword });

    res.status(201).json({ agent: result.rows[0], message: 'Agent created and credentials sent by email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE agent
exports.deleteAgent = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = $1 AND role = $2', [id, 'agent']);
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'DELETE_AGENT', `Admin deleted agent id: ${id}`]
    );
    res.json({ message: 'Agent removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
