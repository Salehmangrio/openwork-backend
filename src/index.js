const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1);

// ─── Socket.io Setup ─────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: "https://openworkfyp.netlify.app" || "http://localhost:3000",
    methods: ['GET', 'POST'],
    credentials: true,
  },
  allowEIO3: true,
});

// Make io available in routes
app.set('io', io);

// ─── Security Middleware ────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Add COOP header only for HTML responses (not API responses)
// This allows Firebase popup authentication to work correctly
app.use((req, res, next) => {
  const originalJson = res.json;
  const originalSend = res.send;

  // Don't add COOP header to JSON API responses
  res.json = function (data) {
    return originalJson.call(this, data);
  };

  // Add COOP header for HTML responses only
  res.send = function (data) {
    if (typeof data === 'string' && (data.includes('<!DOCTYPE') || data.includes('<html'))) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    }
    return originalSend.call(this, data);
  };

  next();
});

app.use(mongoSanitize());
app.use(xss());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: (req) => {
    // Skip rate limiting for auth endpoints to allow login/register
    return req.path.startsWith('/api/auth');
  },
});
app.use('/api/', limiter);

if (process.env.NODE_ENV === 'production') {
  app.enable('trust proxy');
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
    return res.redirect(`https://${req.headers.host}${req.url}`);
  });
}

// ─── CORS ────────────────────────────────────────────────────
app.use(cors({
  origin: "https://openworkfyp.netlify.app" || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Stripe webhook must receive raw body for signature verification.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// ─── Body Parsing ────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ─────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Static Files ────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/proposals', require('./routes/proposals'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/disputes', require('./routes/disputes'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/skill-tests', require('./routes/skillTests'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/dashboard', require('./routes/dashboard'));

// ─── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'OpenWork API is running 🚀', env: process.env.NODE_ENV });
});

// ─── Serve React in Production ───────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/build')));
  app.get('*', (req, res) =>
    res.sendFile(path.resolve(__dirname, '../../client/build/index.html'))
  );
}

// ─── Global Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// ─── Socket.io Real-Time Chat & Notifications ────────────────
require('./socket/handlers')(io);

// ─── MongoDB Connection ───────────────────────────────────────
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
}

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 OpenWork server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
});

module.exports = { app, io };
