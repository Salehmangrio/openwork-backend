// routes/dashboard.js
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const {
  getFreelancerDashboard,
  getClientDashboard,
  getPerformance,
  getEarningsBreakdown,
  getRecommendations,
} = require('../controllers/dashboardController');

// Freelancer dashboard
router.get('/freelancer', protect, getFreelancerDashboard);
router.get('/client', protect, getClientDashboard);

// Performance metrics
router.get('/performance', protect, getPerformance);

// Earnings breakdown
router.get('/earnings', protect, getEarningsBreakdown);

// Recommendations
router.get('/recommendations', protect, getRecommendations);

module.exports = router;
