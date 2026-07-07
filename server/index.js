const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const db = require('./config/db');
const ipBlock = require('./middleware/ipBlock');
const authRoutes = require('./routes/auth');
const registrationRoutes = require('./routes/registration');
const auditRoutes = require('./routes/audit');
const agentRoutes = require('./routes/agents');
const clientRoutes = require('./routes/client');
const analyticsRoutes = require('./routes/analytics');
const securityRoutes = require('./routes/security');
const automationRoutes = require('./routes/automation');
const communicationRoutes = require('./routes/communication');

const app = express();

// Render (and most PaaS providers) sit behind a reverse proxy — trust the
// X-Forwarded-For header so req.ip reflects the real client IP, which the
// login-attempt monitoring and IP blocklist below both depend on.
app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(o => o.trim()) : []),
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '8mb' }));
app.use(ipBlock);

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const loginLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { message: 'Too many login attempts, please try again in 15 minutes' } });

app.use(globalLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api', registrationRoutes);
app.use('/api', auditRoutes);
app.use('/api', agentRoutes);
app.use('/api', clientRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', securityRoutes);
app.use('/api', automationRoutes);
app.use('/api', communicationRoutes);

app.get('/', (req, res) => res.json({ message: 'ServTech Rwanda API is running' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
