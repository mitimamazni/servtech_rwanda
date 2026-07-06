const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
require('dotenv').config();

const issueSessionToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '8h' });

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        message: 'Your agent application is still awaiting admin approval. You will be able to log in once it is approved.',
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        message: 'This account has been deactivated. Please contact a ServTech administrator.',
      });
    }

    // If 2FA is enabled, don't issue a full session token yet — issue a
    // short-lived pending token that only 2fa-verify will accept.
    if (user.totp_enabled) {
      const pendingToken = jwt.sign({ id: user.id, pending2FA: true }, process.env.JWT_SECRET, { expiresIn: '5m' });
      return res.json({ requires2FA: true, pendingToken });
    }

    const token = issueSessionToken(user);

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'LOGIN', `User ${user.email} logged in`]
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Second step of login when 2FA is enabled.
exports.verify2FALogin = async (req, res) => {
  const { pendingToken, code } = req.body;
  try {
    let decoded;
    try {
      decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Login session expired. Please log in again.' });
    }
    if (!decoded.pending2FA) return res.status(401).json({ message: 'Invalid login session.' });

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = result.rows[0];
    if (!user || !user.totp_enabled) return res.status(400).json({ message: 'Invalid login session.' });

    const valid = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token: code, window: 1 });
    if (!valid) return res.status(400).json({ message: 'Incorrect authentication code.' });

    const token = issueSessionToken(user);

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'LOGIN', `User ${user.email} logged in (2FA)`]
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, status, totp_enabled FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Step 1 of enabling 2FA: generate a secret and return a scannable QR code.
// The secret is stored but totp_enabled stays false until confirm2FA succeeds,
// so an abandoned setup never locks anyone out.
exports.setup2FA = async (req, res) => {
  try {
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    const email = userResult.rows[0]?.email;

    const secret = speakeasy.generateSecret({ name: `ServTech Rwanda (${email})` });
    await pool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret.base32, req.user.id]);

    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    res.json({ qrDataUrl, secret: secret.base32 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Step 2: confirm the user actually set it up correctly by verifying one code.
exports.confirm2FA = async (req, res) => {
  const { code } = req.body;
  try {
    const result = await pool.query('SELECT totp_secret FROM users WHERE id = $1', [req.user.id]);
    const secret = result.rows[0]?.totp_secret;
    if (!secret) return res.status(400).json({ message: 'No 2FA setup in progress. Please start setup again.' });

    const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
    if (!valid) return res.status(400).json({ message: 'Incorrect code. Please try again.' });

    await pool.query('UPDATE users SET totp_enabled = true WHERE id = $1', [req.user.id]);

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'ENABLE_2FA', 'User enabled two-factor authentication']
    );

    res.json({ message: 'Two-factor authentication enabled.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.disable2FA = async (req, res) => {
  const { code, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user.totp_enabled) return res.status(400).json({ message: '2FA is not enabled.' });

    // Require either a valid current TOTP code or the account password, so a
    // stolen/unlocked session alone can't silently strip 2FA off an account.
    let authorized = false;
    if (code) {
      authorized = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token: code, window: 1 });
    } else if (password) {
      authorized = await bcrypt.compare(password, user.password);
    }
    if (!authorized) return res.status(400).json({ message: 'Incorrect code or password.' });

    await pool.query('UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = $1', [req.user.id]);

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'DISABLE_2FA', 'User disabled two-factor authentication']
    );

    res.json({ message: 'Two-factor authentication disabled.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
