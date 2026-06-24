const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { selfRegister, getClientDashboard, getClientActivity } = require('../controllers/clientController');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

// Public — no auth needed for self-registration
router.post('/client/register', selfRegister);

// Client dashboard — client must be logged in
router.get('/client/dashboard', auth, getClientDashboard);

// Admin only — view any client's activity
router.get('/client/:clientId/activity', auth, adminOnly, getClientActivity);

module.exports = router;
