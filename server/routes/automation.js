const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getRules, toggleRule, reorderRules, getExecutionLog,
  updateRuleConfig, saveRulePositions,
  getEscalationRules, createEscalationRule, updateEscalationRule, toggleEscalationRule, deleteEscalationRule, runEscalationCheck,
  getApprovalChains, toggleApprovalChain, updateApprovalChainSteps,
  getWebhooks, createWebhook, toggleWebhook, deleteWebhook,
} = require('../controllers/automationController');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

// Rules — visual designer + step configuration
router.get('/automation/rules', auth, adminOnly, getRules);
router.patch('/automation/rules/:id/toggle', auth, adminOnly, toggleRule);
router.patch('/automation/rules/:id/config', auth, adminOnly, updateRuleConfig);
router.post('/automation/rules/reorder', auth, adminOnly, reorderRules);
router.post('/automation/rules/positions', auth, adminOnly, saveRulePositions);
router.get('/automation/log', auth, adminOnly, getExecutionLog);

// Escalation rules
router.get('/automation/escalations', auth, adminOnly, getEscalationRules);
router.post('/automation/escalations', auth, adminOnly, createEscalationRule);
router.patch('/automation/escalations/:id', auth, adminOnly, updateEscalationRule);
router.patch('/automation/escalations/:id/toggle', auth, adminOnly, toggleEscalationRule);
router.delete('/automation/escalations/:id', auth, adminOnly, deleteEscalationRule);
router.post('/automation/escalations/check', auth, adminOnly, runEscalationCheck);

// Approval chains
router.get('/automation/approval-chains', auth, adminOnly, getApprovalChains);
router.patch('/automation/approval-chains/:id/toggle', auth, adminOnly, toggleApprovalChain);
router.put('/automation/approval-chains/:id/steps', auth, adminOnly, updateApprovalChainSteps);

// External service integrations (webhooks)
router.get('/automation/webhooks', auth, adminOnly, getWebhooks);
router.post('/automation/webhooks', auth, adminOnly, createWebhook);
router.patch('/automation/webhooks/:id/toggle', auth, adminOnly, toggleWebhook);
router.delete('/automation/webhooks/:id', auth, adminOnly, deleteWebhook);

module.exports = router;
