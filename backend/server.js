// backend/server.js
const express      = require('express');
const session      = require('express-session');
const cors         = require('cors');
const path         = require('path');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');

const app = express();

// ── SECURITY HEADERS (helmet) ───────────────────────────
app.use(helmet({
  contentSecurityPolicy: false  // disabled so inline scripts in HTML files still work
}));

// ── CORS ────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true
}));

// ── BODY PARSING ────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));        // reject oversized payloads
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── INPUT SANITIZATION MIDDLEWARE ───────────────────────
// Strips HTML tags and trims whitespace from all string inputs
// This prevents XSS if any value is ever rendered without escaping
function stripTags(str) {
  return typeof str === 'string'
    ? str.replace(/<[^>]*>/g, '').trim()
    : str;
}
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      req.body[key] = stripTags(req.body[key]);
    }
  }
  next();
}
app.use(sanitizeBody);

// ── RATE LIMITING ────────────────────────────────────────
// Login endpoint: max 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs : 15 * 60 * 1000,  // 15 minutes
  max      : 10,
  message  : { message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders  : false
});

// General API: max 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max     : 200,
  message : { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders  : false
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/',           apiLimiter);

// ── SESSION ──────────────────────────────────────────────
app.use(session({
  secret           : process.env.SESSION_SECRET || 'hostel_secret_key_2025',
  resave           : true,               // refresh session on every request (rolling)
  saveUninitialized: false,
  rolling          : true,               // reset expiry on every active request
  cookie: {
    secure  : false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge  : 1000 * 60 * 30            // 30 minutes of inactivity
  }
}));

// ── STATIC FILES ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── ROUTES ───────────────────────────────────────────────
app.use('/api/auth',        require('./routes/authRoutes'));
app.use('/api/admin',       require('./routes/adminRoutes'));
app.use('/api/student',     require('./routes/studentRoutes'));
app.use('/api/warden',      require('./routes/wardenRoutes'));
app.use('/api/accountant',  require('./routes/accountantRoutes'));
app.use('/api/maintenance', require('./routes/maintenanceRoutes'));

// ── GLOBAL ERROR HANDLER ─────────────────────────────────
// Never expose raw error stack traces to the client
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ message: 'An internal server error occurred.' });
});

// ── CATCH-ALL → serve login page ─────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// ── START ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🏠 Hostel Management System running at http://localhost:${PORT}\n`);
});