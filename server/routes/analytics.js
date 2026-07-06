const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getOverview } = require('../controllers/analyticsController');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

router.get('/analytics/overview', auth, adminOnly, getOverview);

module.exports = router;
