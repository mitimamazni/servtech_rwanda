const express = require('express');
const router = express.Router();
const { login, getMe, verify2FALogin, setup2FA, confirm2FA, disable2FA, changePassword } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { generateChallenge } = require('../utils/captcha');

router.post('/login', login);
router.post('/login/2fa-verify', verify2FALogin);
router.get('/me', authMiddleware, getMe);
router.post('/change-password', authMiddleware, changePassword);

router.get('/captcha', (req, res) => res.json(generateChallenge()));

router.post('/2fa/setup', authMiddleware, setup2FA);
router.post('/2fa/confirm', authMiddleware, confirm2FA);
router.post('/2fa/disable', authMiddleware, disable2FA);

module.exports = router;
