/**
 * middleware/rateLimiter.js
 * Rate limiting for API endpoints
 * Prevents abuse and DoS attacks with tiered limits per endpoint type
 */

const rateLimit = require('express-rate-limit');

// ============================================================
// RATE LIMITERS: Configured by endpoint type
// ============================================================

/**
 * Authentication endpoints: Strict limits to prevent brute force
 * - Login/Signup: 15 requests per 15 minutes per IP
 */
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 15,                   // 15 requests (increased for dev/testing)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'development', // Disable in development
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
});

/**
 * General API endpoints: Standard limits
 * - 100 requests per 15 minutes per user
 */
exports.generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                  // 100 requests
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please wait before trying again.' },
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
});

/**
 * Strict limits for sensitive operations (payments, disputes)
 * - 10 requests per 15 minutes per user
 */
exports.strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                   // 10 requests
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many sensitive operations. Please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
});

/**
 * Very strict limits for payment operations
 * - 5 requests per 30 minutes per user
 */
exports.paymentLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,  // 30 minutes
  max: 5,                    // 5 requests
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment attempts. Please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
});

/**
 * Relaxed limits for search/listing endpoints
 * - 200 requests per 15 minutes per user
 */
exports.relaxedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,                  // 200 requests
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please wait before trying again.' },
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
});