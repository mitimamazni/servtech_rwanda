const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAuditLogs, getUsers } = require('../controllers/auditController');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

router.get('/audit-logs', auth, adminOnly, getAuditLogs);
router.get('/users', auth, adminOnly, getUsers);

module.exports = router;
