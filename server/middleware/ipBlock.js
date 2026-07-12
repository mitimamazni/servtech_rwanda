const pool = require('../config/db');

// Private/reserved ranges should never be treated as "the client" on this
// deployment — every real client reaches this app over the public internet
// through Render's edge. If req.ip ever resolves to one of these (e.g. a
// proxy-chain hop count mismatch), it is not a real visitor and must never
// be blocked, even if a private address somehow ends up in blocked_ips
// (as happened via a direct DB insert during testing — see incident log).
const isPrivateOrReserved = (ip) =>
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/i.test(ip || '');

// Applied globally, early in the middleware chain. Blocks any request whose
// IP address is on the admin-managed blocklist (see securityController).
module.exports = async (req, res, next) => {
  try {
    const ip = req.ip;
    if (isPrivateOrReserved(ip)) return next();

    const result = await pool.query(
      'SELECT 1 FROM blocked_ips WHERE ip_address = $1 AND (expires_at IS NULL OR expires_at > NOW())',
      [ip]
    );
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
