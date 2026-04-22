/**
 * routes/ai.js
 * AI-powered features: chat, proposals, job matching, skill tests, fraud detection
 */
const express = require('express');
const r = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const {
  chat,
  generateProposal,
  getJobMatch,
  getJobRecommendations,
  generateSkillTest,
  evaluateSkillTest,
  detectFraud,
  getSkillSuggestions,
  moderate,
  health,
} = require('../controllers/aiController');

// Chat - works for both logged-in and anonymous users
r.post('/chat', optionalAuth, chat);

// Health check
r.get('/health', health);

// Proposal generation - requires auth
r.post('/proposal/:jobId', protect, generateProposal);

// Job matching
r.get('/job-match/:jobId', protect, getJobMatch);

// Recommendations
r.get('/recommendations', protect, getJobRecommendations);

// Skill tests
r.post('/skill-test/generate', protect, generateSkillTest);
r.post('/skill-test/evaluate', protect, evaluateSkillTest);

// Fraud detection
r.post('/fraud-detect', protect, detectFraud);

// Skill suggestions
r.post('/skill-suggestions', protect, getSkillSuggestions);

// Moderation - works for both logged-in and anonymous users
r.post('/moderate', optionalAuth, moderate);

module.exports = r;
