const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  selfRegister,
  getClientDashboard,
  getClientActivity,
  updateClient,
  validateClient,
  rejectClient,
  setClientActive,
  resubmitKyc,
  getClientDocuments,
} = require('../controllers/clientController');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

const adminOrAgent = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'agent') {
    return res.status(403).json({ message: 'Admin or agent access required' });
  }
  next();
};

// Public — no auth needed for self-registration
router.post('/client/register', selfRegister);

// Client dashboard — client must be logged in
router.get('/client/dashboard', auth, getClientDashboard);

// Client self-service — resubmit KYC after a rejection
router.post('/client/resubmit', auth, resubmitKyc);

// Admin: any client. Agent: only clients they personally registered (checked in controller).
router.get('/client/:clientId/activity', auth, adminOrAgent, getClientActivity);
router.get('/clients/:clientId/documents', auth, adminOrAgent, getClientDocuments);

// Admin: any client. Agent: only clients they personally registered (checked in controller).
router.put('/clients/:clientId', auth, adminOrAgent, updateClient);
router.patch('/clients/:clientId/active', auth, adminOrAgent, setClientActive);

// Admin only — KYC decisions
router.patch('/clients/:clientId/validate', auth, adminOnly, validateClient);
router.patch('/clients/:clientId/reject', auth, adminOnly, rejectClient);

module.exports = router;
