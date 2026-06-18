const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const db = require('./config/db');
const authRoutes = require('./routes/auth');
const registrationRoutes = require('./routes/registration');
const auditRoutes = require('./routes/audit');

const app = express();

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts, please try again in 15 minutes' },
});

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(globalLimiter);

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api', registrationRoutes);
app.use('/api', auditRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'ServTech Rwanda API is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
