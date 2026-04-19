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
// router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
router.put('/update-password', protect, updatePassword);
router.post('/logout', protect, logout);
// GET /api/auth/verify-email/:token
router.get('/verify-email/:token',verifyEmail);
router.post('/resend-verification', protect, resendVerification);

module.exports = router;