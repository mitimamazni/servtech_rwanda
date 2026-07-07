const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getLoginAttempts,
  getSecurityAlerts,
  getBlockedIps,
  blockIp,
  unblockIp,
} = require('../controllers/securityController');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

router.get('/security/login-attempts', auth, adminOnly, getLoginAttempts);
router.get('/security/alerts', auth, adminOnly, getSecurityAlerts);
router.get('/security/blocked-ips', auth, adminOnly, getBlockedIps);
router.post('/security/blocked-ips', auth, adminOnly, blockIp);
router.delete('/security/blocked-ips/:id', auth, adminOnly, unblockIp);

module.exports = router;
