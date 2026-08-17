const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getMatches,
  placeBet,
  getAllMatches,
  createMatch,
  settleMatch,
  getAllBets,
  topUpWallet,
} = require('../controllers/bettingController');

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

// Client-facing sportsbook
router.get('/matches', auth, clientOnly, getMatches);
router.post('/bets', auth, clientOnly, placeBet);

// Admin — manage matches, settle results, oversee all bets
router.get('/admin/matches', auth, adminOnly, getAllMatches);
router.post('/admin/matches', auth, adminOnly, createMatch);
router.patch('/admin/matches/:id/settle', auth, adminOnly, settleMatch);
router.get('/admin/bets', auth, adminOnly, getAllBets);

// Admin or agent — top up a client's wallet (simulated funds)
router.post('/clients/:clientId/wallet/topup', auth, adminOrAgent, topUpWallet);

module.exports = router;
