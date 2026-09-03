require('dotenv').config();

const express      = require('express');
const path = require('path');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const { connectDB }   = require('./config/db');
const errorHandler    = require('./middleware/error');

const authRoutes      = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const orderRoutes     = require('./routes/orders');
const productRoutes   = require('./routes/products');
const enquiryRoutes   = require('./routes/enquiries');
const businessSettingsRoutes = require('./routes/businessSettings');

// Connect MySQL
connectDB();

const app  = express();
const isProd = process.env.NODE_ENV === 'production';

// Helmet (security headers) 
app.use(
  helmet({
    contentSecurityPolicy: isProd ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com', 'kit.fontawesome.com', '*.fontawesome.com'],
        styleSrc:   ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdnjs.cloudflare.com'],
        fontSrc:    ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com', '*.fontawesome.com'],
        imgSrc:     ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        frameSrc:   ["'none'"],
        objectSrc:  ["'none'"],
      },
    } : false,
    crossOriginEmbedderPolicy: false,  // needed for FontAwesome CDN
  })
);


const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Local dev fallback — never active in production if CORS_ORIGINS is set
if (!isProd && allowedOrigins.length === 0) {
  allowedOrigins.push(
    'http://localhost:5500',
     'http://127.0.0.1:5500',
    'http://localhost:5501', 
    'http://127.0.0.1:5501',
    'http://localhost:3000'
  );
}

app.use(
  cors({
    origin(origin, cb) {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],   // no Authorization header — cookie only
  })
);

// Rate limiting 
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, error: 'Too many login attempts — try again in 15 minutes' },
  skipSuccessfulRequests: true,   // only count failures toward the limit
});

const publicLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, error: 'Rate limit exceeded' },
});

const adminLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             120,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, error: 'Rate limit exceeded' },
});

// Body parsing 
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use(cookieParser());
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader(
      'Cross-Origin-Resource-Policy',
      'cross-origin'
    );
    next();
  },
  express.static(path.join(__dirname, 'uploads'))
);

if (!isProd) {
  app.use(morgan('dev'));
}

// ── Health check — minimal, no internal details in production ─────
app.get('/health', (_req, res) => {
  res.json(isProd
    ? { status: 'ok' }
    : { status: 'ok', env: process.env.NODE_ENV, ts: new Date() }
  );
});

// API routes
app.use('/api/v1/auth',      authLimiter,   authRoutes);
app.use('/api/v1/dashboard', adminLimiter,  dashboardRoutes);
app.use('/api/v1/orders',    publicLimiter, orderRoutes);
app.use('/api/v1/products',  publicLimiter, productRoutes);
app.use('/api/v1/enquiries', publicLimiter, enquiryRoutes);
app.use('/api/v1/business-settings', publicLimiter, businessSettingsRoutes);
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader(
      'Cross-Origin-Resource-Policy',
      'cross-origin'
    );
    next();
  },
  express.static(path.join(__dirname, 'uploads'))
);
// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});
 
// Global error handler 
app.use(errorHandler);

// Start server
const PORT   = Number(process.env.PORT) || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n🚀  Misrak Coffee API — port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  if (!isProd) {
    console.log(`   Health  : http://localhost:${PORT}/health`);
    console.log(`   CORS    : ${allowedOrigins.join(', ')}`);
  }
  console.log();
});


process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err?.message || err);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err?.message || err);
  server.close(() => process.exit(1));
});
