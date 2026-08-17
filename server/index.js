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
const bettingRoutes = require('./routes/betting');
const ticketRoutes = require('./routes/tickets');

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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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
const loginLimiter  = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true, // only failed logins count — a successful login on one account
                                 // shouldn't eat into the quota for every other account on the same IP
  message: { message: 'Too many failed login attempts, please try again in 15 minutes' },
});

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
app.use('/api', bettingRoutes);
app.use('/api', ticketRoutes);

app.get('/', (req, res) => res.json({ message: 'ServTech Rwanda API is running' }));

// Temporary diagnostic route — lets you confirm req.ip is resolving to your
// real public IP rather than an internal Render proxy hop. Open this in a
// browser and compare the "ip" field to "what's my ip" for the same device.
// Safe to delete once trust proxy is confirmed correct; exposes nothing
// beyond what the requester already knows about their own connection.
app.get('/debug/ip', (req, res) => res.json({
  ip: req.ip,
  ips: req.ips,
  xForwardedFor: req.headers['x-forwarded-for'] || null,
  socketRemoteAddress: req.socket.remoteAddress,
}));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
