const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAgents, createAgent, deleteAgent } = require('../controllers/agentController');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

router.get('/agents', auth, adminOnly, getAgents);
router.post('/agents', auth, adminOnly, createAgent);
router.delete('/agents/:id', auth, adminOnly, deleteAgent);

module.exports = router;
