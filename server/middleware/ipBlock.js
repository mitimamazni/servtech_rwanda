const pool = require('../config/db');

// Applied globally, early in the middleware chain. Blocks any request whose
// IP address is on the admin-managed blocklist (see securityController).
module.exports = async (req, res, next) => {
  try {
    const ip = req.ip;
    const result = await pool.query('SELECT 1 FROM blocked_ips WHERE ip_address = $1', [ip]);
    if (result.rows.length > 0) {
      return res.status(403).json({ message: 'Access from this network has been blocked.' });
    }
    next();
  } catch (err) {
    // Fail open on a DB hiccup rather than locking everyone out of the whole app.
    console.error('IP block check failed:', err);
    next();
  }
};
