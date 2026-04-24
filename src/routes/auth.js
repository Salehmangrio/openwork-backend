// ============================================================
// routes/auth.js
// ============================================================
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter'); // Add rate limiter

const {
  register,
  login,
  getMe,
  verifyEmail,
  verifyEmailOtp,
  resendEmailOtp,
  forgotPassword,
  resetPassword,
  updatePassword,
  logout,
  googleAuth,
  googleComplete,
  firebaseAuth,
  firebaseRegister,
  resendVerification
} = require('../controllers/authController');

// Apply rate limiter only to sensitive routes
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/google', googleAuth);
router.post('/google-complete', authLimiter, googleComplete);
router.post('/firebase-register', authLimiter, firebaseRegister); // Register via Firebase
router.post('/firebase-login', firebaseAuth); // Login via Firebase
router.get('/me', protect, getMe);

// Email verification routes (OTP-based)
router.post('/verify-email-otp', authLimiter, verifyEmailOtp);
router.post('/resend-email-otp', authLimiter, resendEmailOtp);

// Legacy token-based route (kept for backward compatibility)
router.get('/verify-email/:token', verifyEmail);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
router.put('/update-password', protect, updatePassword);

// Logout
router.post('/logout', protect, logout);

// Resend verification (OTP)
router.post('/resend-verification', protect, resendVerification);

module.exports = router;