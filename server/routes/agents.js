const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getAgents,
  createAgent,
  deleteAgent,
  getAgentDetail,
  updateAgent,
  setAgentStatus,
  resetAgentPassword,
} = require('../controllers/agentController');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

// Agent self-registration removed — agents are created by an admin only
// (see registerClient point 2 / createAgent), self-signup was out of scope.

router.get('/agents', auth, adminOnly, getAgents);
router.get('/agents/:id', auth, adminOnly, getAgentDetail);
router.post('/agents', auth, adminOnly, createAgent);
router.put('/agents/:id', auth, adminOnly, updateAgent);
router.patch('/agents/:id/status', auth, adminOnly, setAgentStatus);
router.patch('/agents/:id/reset-password', auth, adminOnly, resetAgentPassword);
router.delete('/agents/:id', auth, adminOnly, deleteAgent);

module.exports = router;
