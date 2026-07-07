const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getMessageLog,
  sendBulkMessage,
} = require('../controllers/communicationController');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

router.get('/communications/templates', auth, adminOnly, getTemplates);
router.post('/communications/templates', auth, adminOnly, createTemplate);
router.put('/communications/templates/:id', auth, adminOnly, updateTemplate);
router.delete('/communications/templates/:id', auth, adminOnly, deleteTemplate);

router.get('/communications/log', auth, adminOnly, getMessageLog);
router.post('/communications/send', auth, adminOnly, sendBulkMessage);

module.exports = router;
