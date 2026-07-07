const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getRules, toggleRule, reorderRules, getExecutionLog } = require('../controllers/automationController');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

router.get('/automation/rules', auth, adminOnly, getRules);
router.patch('/automation/rules/:id/toggle', auth, adminOnly, toggleRule);
router.post('/automation/rules/reorder', auth, adminOnly, reorderRules);
router.get('/automation/log', auth, adminOnly, getExecutionLog);

module.exports = router;
