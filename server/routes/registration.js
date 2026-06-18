const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const {
  verifyId,
  registerClient,
  getClients,
  getStats,
} = require('../controllers/registrationController');

const validateRegistration = [
  body('id_number')
    .trim()
    .isLength({ min: 16, max: 16 })
    .withMessage('ID number must be exactly 16 characters')
    .isNumeric()
    .withMessage('ID number must contain only digits'),
  body('first_name')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 100 })
    .withMessage('First name too long'),
  body('last_name')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 100 })
    .withMessage('Last name too long'),
  body('phone')
    .optional()
    .trim()
    .matches(/^07[0-9]{8}$/)
    .withMessage('Phone must be a valid Rwandan number'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    next();
  },
];

router.post('/verify-id', auth, verifyId);
router.post('/register', auth, validateRegistration, registerClient);
router.get('/clients', auth, getClients);
router.get('/stats', auth, getStats);

module.exports = router;
