const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createTicket,
  getMyTickets,
  getAllTickets,
  getTicket,
  addMessage,
  updateStatus,
  assignTicket,
} = require('../controllers/ticketController');

const clientOnly = (req, res, next) => {
  if (req.user.role !== 'client') return res.status(403).json({ message: 'Client access required' });
  next();
};

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

// Client
router.post('/tickets', auth, clientOnly, createTicket);
router.get('/tickets', auth, clientOnly, getMyTickets);

// Admin/agent list (scoped to agent's own clients + assigned tickets server-side)
router.get('/admin/tickets', auth, adminOrAgent, getAllTickets);

// Shared — ownership/scope enforced in the controller
router.get('/tickets/:id', auth, getTicket);
router.post('/tickets/:id/messages', auth, addMessage);
router.patch('/tickets/:id/status', auth, updateStatus);
router.patch('/tickets/:id/assign', auth, adminOnly, assignTicket);

module.exports = router;
