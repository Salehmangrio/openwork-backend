const express = require('express');
const r = express.Router();
const { protect } = require('../middleware/auth');
const { 
  generateSkillTest, 
  evaluateSkillTest, 
  submitSkillTest, 
  getCertifications 
} = require('../controllers/skillTestController');

/**
 * @route   GET /api/skill-tests/generate
 * @desc    Generate skill test questions
 * @access  Private
 */
r.get('/generate', protect, generateSkillTest);

/**
 * @route   POST /api/skill-tests/evaluate
 * @desc    Evaluate skill test answers
 * @access  Private
 */
r.post('/evaluate', protect, evaluateSkillTest);

/**
 * @route   POST /api/skill-tests/submit
 * @desc    Submit skill test (legacy endpoint)
 * @access  Private
 */
r.post('/submit', protect, submitSkillTest);

/**
 * @route   GET /api/skill-tests/certifications
 * @desc    Get user certifications
 * @access  Private
 */
r.get('/certifications', protect, getCertifications);

module.exports = r;
