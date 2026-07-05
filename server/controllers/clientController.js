const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { sendClientWelcomeEmail } = require('../utils/email');

<<<<<<< HEAD
const MIN_AGE = 18;
const ELDERLY_AGE = 80;

const yearMismatch = (id_number, date_of_birth) => {
  if (!id_number || !date_of_birth || id_number.length < 5) return false;
  const idYear = parseInt(id_number.substring(1, 5));
  const dobYear = new Date(date_of_birth).getFullYear();
  if (Number.isNaN(idYear) || Number.isNaN(dobYear)) return false;
  return idYear !== dobYear;
};

=======
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
// Client self-registration
exports.selfRegister = async (req, res) => {
  const { id_number, first_name, last_name, date_of_birth, gender, phone, district, email } = req.body;

  try {
<<<<<<< HEAD
    // Duplicate client check — a previously *rejected* attempt (e.g. the person was
    // under 18 at the time) should not permanently block a legitimate later attempt,
    // so only an active (pending/verified) record counts as a real duplicate.
    const existingClient = await pool.query(
      "SELECT id, status FROM clients WHERE id_number = $1 AND status != 'rejected'",
      [id_number]
    );
    if (existingClient.rows.length > 0) {
      return res.status(400).json({
        message: 'This ID is already registered on ServTech Rwanda.',
        duplicate: true,
      });
    }

=======
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
    // Age check from ID number format: positions 1-4 = birth year
    const birthYear = parseInt(id_number.substring(1, 5));
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;
<<<<<<< HEAD

    // Under 18 or over 80 via self-service: record the attempt as a rejected
    // client (no login account is created) so it's visible to admins under the
    // "Rejected" filter, and direct the person to an agent for assisted registration.
    if (age < MIN_AGE || age > ELDERLY_AGE) {
      const reason = age < MIN_AGE
        ? `Under ${MIN_AGE} - minimum registration age not met (approx. age ${age})`
        : `Over ${ELDERLY_AGE} - self-service registration requires agent-assisted identity confirmation (approx. age ${age})`;

      // Upsert: replaces any earlier rejected attempt for the same ID number
      // instead of failing on the unique id_number constraint.
      const rejectedResult = await pool.query(
        `INSERT INTO clients (id_number, first_name, last_name, date_of_birth, gender, phone, district, status, rejection_reason, registered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'rejected', $8, NULL)
         ON CONFLICT (id_number) DO UPDATE SET
           first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
           date_of_birth = EXCLUDED.date_of_birth, gender = EXCLUDED.gender,
           phone = EXCLUDED.phone, district = EXCLUDED.district,
           status = 'rejected', rejection_reason = EXCLUDED.rejection_reason,
           registered_by = NULL, created_at = NOW()
         RETURNING *`,
        [id_number, first_name, last_name, date_of_birth, gender, phone, district, reason]
      );

      await pool.query(
        'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [null, 'SELF_REGISTER_REJECTED', `Self-registration rejected for ${id_number}: ${reason}`]
      );

      return res.status(400).json({
        message: age < MIN_AGE
          ? 'Registration denied. You must be 18 or older to register.'
          : `For clients over ${ELDERLY_AGE}, please visit a ServTech agent for assisted registration so your identity can be confirmed in person.`,
        underAge: age < MIN_AGE,
        elderlyAssistRequired: age > ELDERLY_AGE,
        client: rejectedResult.rows[0],
      });
    }

    // Year consistency check — even if the ID isn't in the registry.
    if (yearMismatch(id_number, date_of_birth)) {
      return res.status(400).json({
        message: 'The date of birth does not match the birth year encoded in the ID number. Please review both fields.',
        yearMismatch: true,
=======
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
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
      });
    }

    // Duplicate email check
    const existingEmail = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ message: 'This email address is already in use.' });
    }

<<<<<<< HEAD
    // A previously-rejected record for this ID number is superseded now that the
    // person is eligible — clear it out before inserting the real record.
    await pool.query("DELETE FROM clients WHERE id_number = $1 AND status = 'rejected'", [id_number]);

=======
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
    // Verify against registry
    const idCheck = await pool.query('SELECT id FROM id_records WHERE id_number = $1 AND valid = true', [id_number]);
    const status = idCheck.rows.length > 0 ? 'verified' : 'pending';

<<<<<<< HEAD
    // Generate password (looped to guarantee uniqueness against existing hashes is not
    // meaningful for bcrypt, so instead we simply guarantee the raw password itself is
    // freshly randomised per registration)
=======
    // Generate password
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
    const rawPassword = `ST@${first_name.charAt(0).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(10 + Math.random() * 90)}!`;
    const hashed = await bcrypt.hash(rawPassword, 10);

    // Create user account
    const userResult = await pool.query(
<<<<<<< HEAD
      'INSERT INTO users (name, email, password, role, phone, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [`${first_name} ${last_name}`, email, hashed, 'client', phone, 'active']
=======
      'INSERT INTO users (name, email, password, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [`${first_name} ${last_name}`, email, hashed, 'client', phone]
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
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

<<<<<<< HEAD
// Admin: any client. Agent: only a client they personally registered.
=======
// Admin: get any client's betting activity
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
exports.getClientActivity = async (req, res) => {
  const { clientId } = req.params;
  try {
    const clientResult = await pool.query(
<<<<<<< HEAD
      `SELECT c.*, u.email, u2.name as agent_name, u2.phone as agent_phone, u2.id as agent_id
=======
      `SELECT c.*, u.email, u2.name as agent_name, u2.phone as agent_phone
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
       FROM clients c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN users u2 ON c.registered_by = u2.id
       WHERE c.id = $1`,
      [clientId]
    );
    if (clientResult.rows.length === 0) return res.status(404).json({ message: 'Client not found' });

<<<<<<< HEAD
    const client = clientResult.rows[0];
    if (req.user.role === 'agent' && client.agent_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only view clients you registered' });
    }

=======
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
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

<<<<<<< HEAD
    res.json({ client, bets: bettingResult.rows, stats: statsResult.rows[0] });
=======
    res.json({ client: clientResult.rows[0], bets: bettingResult.rows, stats: statsResult.rows[0] });
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
<<<<<<< HEAD

// Shared helper: fetch a client and confirm the requesting user is allowed to act on it.
// Admin can act on any client; an agent only on clients they personally registered.
const findClientForAction = async (clientId, user) => {
  const result = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
  if (result.rows.length === 0) return { error: 404, message: 'Client not found' };
  const client = result.rows[0];
  if (user.role === 'agent' && client.registered_by !== user.id) {
    return { error: 403, message: 'You can only manage clients you registered' };
  }
  return { client };
};

// Admin or owning agent: update editable client details (CRUD - update)
exports.updateClient = async (req, res) => {
  const { clientId } = req.params;
  const { first_name, last_name, date_of_birth, gender, phone, district } = req.body;

  try {
    const { error, message, client } = await findClientForAction(clientId, req.user);
    if (error) return res.status(error).json({ message });

    if (yearMismatch(client.id_number, date_of_birth || client.date_of_birth)) {
      return res.status(400).json({
        message: 'The date of birth does not match the birth year encoded in the ID number.',
        yearMismatch: true,
      });
    }

    const result = await pool.query(
      `UPDATE clients SET
         first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         date_of_birth = COALESCE($3, date_of_birth),
         gender = COALESCE($4, gender),
         phone = COALESCE($5, phone),
         district = COALESCE($6, district)
       WHERE id = $7 RETURNING *`,
      [first_name, last_name, date_of_birth, gender, phone, district, clientId]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'UPDATE_CLIENT', `Updated client ${client.id_number} (id ${clientId})`]
    );

    res.json({ message: 'Client updated', client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin only: approve a pending client (KYC "Validate" action)
exports.validateClient = async (req, res) => {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `UPDATE clients SET status = 'verified', rejection_reason = NULL WHERE id = $1 RETURNING *`,
      [clientId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'VALIDATE_CLIENT', `Validated client ${result.rows[0].id_number} (id ${clientId})`]
    );

    res.json({ message: 'Client verified', client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin only: reject a pending client, with an optional reason
exports.rejectClient = async (req, res) => {
  const { clientId } = req.params;
  const { reason } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clients SET status = 'rejected', rejection_reason = $1 WHERE id = $2 RETURNING *`,
      [reason || 'Rejected on manual review', clientId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'REJECT_CLIENT', `Rejected client ${result.rows[0].id_number} (id ${clientId})${reason ? ` - reason: ${reason}` : ''}`]
    );

    res.json({ message: 'Client rejected', client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin or owning agent: deactivate / reactivate a client record.
// If the client has a linked login account, that login is suspended/reactivated too.
exports.setClientActive = async (req, res) => {
  const { clientId } = req.params;
  const { is_active } = req.body;
  try {
    const { error, message, client } = await findClientForAction(clientId, req.user);
    if (error) return res.status(error).json({ message });

    const result = await pool.query(
      'UPDATE clients SET is_active = $1 WHERE id = $2 RETURNING *',
      [!!is_active, clientId]
    );

    if (client.user_id) {
      await pool.query('UPDATE users SET status = $1 WHERE id = $2', [is_active ? 'active' : 'suspended', client.user_id]);
    }

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, is_active ? 'ACTIVATE_CLIENT' : 'DEACTIVATE_CLIENT', `${is_active ? 'Activated' : 'Deactivated'} client ${client.id_number} (id ${clientId})`]
    );

    res.json({ message: is_active ? 'Client activated' : 'Client deactivated', client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
=======
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
