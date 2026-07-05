const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
<<<<<<< HEAD
const {
  getAgents,
  createAgent,
  deleteAgent,
  getAgentDetail,
  selfRegisterAgent,
  updateAgent,
  setAgentStatus,
} = require('../controllers/agentController');
=======
const { getAgents, createAgent, deleteAgent } = require('../controllers/agentController');
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

<<<<<<< HEAD
// Public — an aspiring agent applies for an account (pending admin approval)
router.post('/agents/self-register', selfRegisterAgent);

router.get('/agents', auth, adminOnly, getAgents);
router.get('/agents/:id', auth, adminOnly, getAgentDetail);
router.post('/agents', auth, adminOnly, createAgent);
router.put('/agents/:id', auth, adminOnly, updateAgent);
router.patch('/agents/:id/status', auth, adminOnly, setAgentStatus);
=======
router.get('/agents', auth, adminOnly, getAgents);
router.post('/agents', auth, adminOnly, createAgent);
>>>>>>> 9db6d6819db7fd9c6c82e857825fdc88fc7fd189
router.delete('/agents/:id', auth, adminOnly, deleteAgent);

module.exports = router;
