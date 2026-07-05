const pool = require('../config/db');
const bcrypt = require('bcryptjs');
<<<<<<< HEAD
const { sendAgentWelcomeEmail, sendAgentApprovedEmail } = require('../utils/email');

// GET all agents (includes pending applications and suspended accounts)
exports.getAgents = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at,
=======
const { sendAgentWelcomeEmail } = require('../utils/email');

// GET all agents
exports.getAgents = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, u.created_at,
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
             COUNT(c.id) AS clients_registered
      FROM users u
      LEFT JOIN clients c ON c.registered_by = u.id
      WHERE u.role = 'agent'
      GROUP BY u.id
<<<<<<< HEAD
      ORDER BY
        CASE u.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
        u.created_at DESC
=======
      ORDER BY u.created_at DESC
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

<<<<<<< HEAD
// GET a single agent + the clients they've registered (agent detail / "agent view")
exports.getAgentDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const agentResult = await pool.query(
      `SELECT id, name, email, phone, status, created_at FROM users WHERE id = $1 AND role = 'agent'`,
      [id]
    );
    if (agentResult.rows.length === 0) return res.status(404).json({ message: 'Agent not found' });

    const clientsResult = await pool.query(
      `SELECT id, first_name, last_name, id_number, status, is_active, created_at
       FROM clients WHERE registered_by = $1 ORDER BY created_at DESC`,
      [id]
    );

    res.json({ agent: agentResult.rows[0], clients: clientsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUBLIC — an aspiring agent applies for an account. Account is created immediately
// but with status 'pending', so it cannot log in until an admin approves it.
exports.selfRegisterAgent = async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, phone, status)
       VALUES ($1, $2, $3, 'agent', $4, 'pending') RETURNING id, name, email, phone, status, created_at`,
      [name, email, hashed, phone || null]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [result.rows[0].id, 'AGENT_SELF_REGISTER', `Agent application submitted: ${email}`]
    );

    res.status(201).json({
      message: 'Application submitted. An administrator will review it before your account is activated.',
      agent: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin only — edit an agent's details (CRUD - update)
exports.updateAgent = async (req, res) => {
  const { id } = req.params;
  const { name, phone } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone)
       WHERE id = $3 AND role = 'agent' RETURNING id, name, email, phone, status, created_at`,
      [name, phone, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Agent not found' });

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'UPDATE_AGENT', `Updated agent id ${id}`]
    );

    res.json({ message: 'Agent updated', agent: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin only — unified status changes: approve/reject a pending application,
// or deactivate/reactivate an existing agent.
exports.setAgentStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['pending', 'active', 'suspended'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
  }

  try {
    const existing = await pool.query(`SELECT * FROM users WHERE id = $1 AND role = 'agent'`, [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Agent not found' });
    const wasPending = existing.rows[0].status === 'pending';

    const result = await pool.query(
      `UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name, email, phone, status, created_at`,
      [status, id]
    );
    const agent = result.rows[0];

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'AGENT_STATUS_CHANGE', `Agent ${agent.email} status set to ${status}`]
    );

    if (wasPending && status === 'active') {
      await sendAgentApprovedEmail({ name: agent.name, email: agent.email });
    }

    res.json({ message: `Agent status updated to ${status}`, agent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

=======
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
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
<<<<<<< HEAD
      `INSERT INTO users (name, email, password, role, phone, status) VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, name, email, phone, status, created_at`,
=======
      'INSERT INTO users (name, email, password, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, created_at',
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
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
