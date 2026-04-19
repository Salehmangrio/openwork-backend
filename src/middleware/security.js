/**
 * middleware/security.js
 * Security-related middleware
 * CORS, security headers, input sanitization
 */

const cors = require('cors');
const mongoSanitize = require('mongo-sanitize');
const xss = require('xss-clean');
const helmet = require('helmet');

/**
 * CORS configuration
 * Allows requests from frontend domains
 */
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',      // Vite dev
      'http://localhost:3000',      // React dev
      'http://localhost:8000',      // Another local instance
      process.env.FRONTEND_URL,     // Production frontend
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

const corsMiddleware = cors(corsOptions);

/**
 * Security headers via Helmet
 * Protects against various attacks
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * Data sanitization to prevent NoSQL injection
 */
const sanitizationMiddleware = [
  mongoSanitize(),  // Removes $ from object keys for NoSQL injection prevention
  xss(), // Cleans request data from XSS attacks
];

/**
 * Rate limit reset error handler
 * Provides better rate limit error messages
 */
const rateLimitErrorHandler = (err, req, res, next) => {
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      message: err.message,
      retryAfter: err.retryAfter,
    });
  }
  next(err);
};

module.exports = {
  corsMiddleware,
  helmetMiddleware,
  sanitizationMiddleware,
  rateLimitErrorHandler,
};