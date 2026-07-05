const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getAgents,
  createAgent,
  deleteAgent,
  getAgentDetail,
  selfRegisterAgent,
  updateAgent,
  setAgentStatus,
} = require('../controllers/agentController');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

// Public — an aspiring agent applies for an account (pending admin approval)
router.post('/agents/self-register', selfRegisterAgent);

router.get('/agents', auth, adminOnly, getAgents);
router.get('/agents/:id', auth, adminOnly, getAgentDetail);
router.post('/agents', auth, adminOnly, createAgent);
router.put('/agents/:id', auth, adminOnly, updateAgent);
router.patch('/agents/:id/status', auth, adminOnly, setAgentStatus);
router.delete('/agents/:id', auth, adminOnly, deleteAgent);

module.exports = router;
