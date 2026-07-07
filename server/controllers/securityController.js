const pool = require('../config/db');

// Recent login attempts (paginated), most recent first — for the monitoring dashboard.
exports.getLoginAttempts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await pool.query(
      `SELECT id, email, ip_address, success, reason, created_at
       FROM login_attempts ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ attempts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Derived alerts — simple, explainable heuristics rather than a black-box model:
//   - 5+ failed logins from the same IP in the last 15 minutes
//   - 5+ failed logins against the same email in the last 15 minutes
exports.getSecurityAlerts = async (req, res) => {
  try {
    const byIp = await pool.query(`
      SELECT ip_address, COUNT(*) AS attempts, MAX(created_at) AS last_attempt
      FROM login_attempts
      WHERE success = false AND created_at >= NOW() - INTERVAL '15 minutes'
      GROUP BY ip_address
      HAVING COUNT(*) >= 5
      ORDER BY attempts DESC
    `);
    const byEmail = await pool.query(`
      SELECT email, COUNT(*) AS attempts, MAX(created_at) AS last_attempt
      FROM login_attempts
      WHERE success = false AND created_at >= NOW() - INTERVAL '15 minutes'
      GROUP BY email
      HAVING COUNT(*) >= 5
      ORDER BY attempts DESC
    `);

    const alerts = [
      ...byIp.rows.map(r => ({
        type: 'ip_brute_force',
        severity: 'high',
        message: `${r.attempts} failed login attempts from IP ${r.ip_address} in the last 15 minutes`,
        ip_address: r.ip_address,
        last_attempt: r.last_attempt,
      })),
      ...byEmail.rows.map(r => ({
        type: 'account_brute_force',
        severity: 'high',
        message: `${r.attempts} failed login attempts against ${r.email} in the last 15 minutes`,
        email: r.email,
        last_attempt: r.last_attempt,
      })),
    ];

    res.json({ alerts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getBlockedIps = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.ip_address, b.reason, b.created_at, u.name as blocked_by
       FROM blocked_ips b LEFT JOIN users u ON b.created_by = u.id
       ORDER BY b.created_at DESC`
    );
    res.json({ blockedIps: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.blockIp = async (req, res) => {
  const { ip_address, reason } = req.body;
  if (!ip_address) return res.status(400).json({ message: 'IP address is required' });
  try {
    const result = await pool.query(
      `INSERT INTO blocked_ips (ip_address, reason, created_by) VALUES ($1, $2, $3)
       ON CONFLICT (ip_address) DO UPDATE SET reason = $2
       RETURNING id, ip_address, reason, created_at`,
      [ip_address.trim(), reason || null, req.user.id]
    );
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'BLOCK_IP', `Blocked IP ${ip_address}${reason ? ` - reason: ${reason}` : ''}`]
    );
    res.status(201).json({ message: 'IP blocked', blockedIp: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.unblockIp = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM blocked_ips WHERE id = $1 RETURNING ip_address', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'UNBLOCK_IP', `Unblocked IP ${result.rows[0].ip_address}`]
    );
    res.json({ message: 'IP unblocked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
