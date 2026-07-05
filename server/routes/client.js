const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
<<<<<<< HEAD
const {
  selfRegister,
  getClientDashboard,
  getClientActivity,
  updateClient,
  validateClient,
  rejectClient,
  setClientActive,
} = require('../controllers/clientController');
=======
const { selfRegister, getClientDashboard, getClientActivity } = require('../controllers/clientController');
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

<<<<<<< HEAD
const adminOrAgent = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'agent') {
    return res.status(403).json({ message: 'Admin or agent access required' });
  }
  next();
};

=======
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
// Public — no auth needed for self-registration
router.post('/client/register', selfRegister);

// Client dashboard — client must be logged in
router.get('/client/dashboard', auth, getClientDashboard);

<<<<<<< HEAD
// Admin: any client. Agent: only clients they personally registered (checked in controller).
router.get('/client/:clientId/activity', auth, adminOrAgent, getClientActivity);

// Admin: any client. Agent: only clients they personally registered (checked in controller).
router.put('/clients/:clientId', auth, adminOrAgent, updateClient);
router.patch('/clients/:clientId/active', auth, adminOrAgent, setClientActive);

// Admin only — KYC decisions
router.patch('/clients/:clientId/validate', auth, adminOnly, validateClient);
router.patch('/clients/:clientId/reject', auth, adminOnly, rejectClient);
=======
// Admin only — view any client's activity
router.get('/client/:clientId/activity', auth, adminOnly, getClientActivity);
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189

module.exports = router;
