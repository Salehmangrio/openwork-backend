/**
 * aiController.js - Fixed version
 *
 * Bug Fix #12: chat handler accessed req.user.role unconditionally even though
 * the /chat route uses `optionalAuth` (user may be null/undefined for guests).
 * Fixed with optional chaining.
 */

const aiService = require('../services/aiService');

exports.generateProposal = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const result = await aiService.generateProposal(req.user._id, jobId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getJobMatch = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const result = await aiService.calculateJobMatch(req.user._id, jobId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getJobRecommendations = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const result = await aiService.getJobRecommendations(req.user._id, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Bug Fix #12: req.user can be undefined when optionalAuth passes through a guest
exports.chat = async (req, res, next) => {
  try {
    const { messages, userContext, systemContext } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'messages array is required' });
    }

    const context = {
      userRole: req.user?.role || 'user',          // ← safe optional chain
      userContext: userContext || systemContext || '',
    };

    const result = await aiService.chat(messages, context);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.analyzeProfile = async (req, res, next) => {
  try {
    const result = await aiService.analyzeProfile(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getLearningRecommendations = async (req, res, next) => {
  try {
    const { skills } = req.body;
    const result = await aiService.getLearningRecommendations(req.user._id, skills);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.generateSkillTest = async (req, res, next) => {
  try {
    const { topic, level } = req.query;
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }
    const result = await aiService.generateSkillTest(topic, level || 'easy');
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.evaluateSkillTest = async (req, res, next) => {
  try {
    const { topic, questions } = req.body;
    if (!topic || !questions) {
      return res.status(400).json({ success: false, message: 'Topic and questions are required' });
    }
    const result = await aiService.evaluateSkillTest(req.user._id, topic, questions);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.detectFraud = async (req, res, next) => {
  try {
    const { loginPatterns, bidAmounts, responseTimes } = req.body;
    const result = await aiService.detectFraud(loginPatterns, bidAmounts, responseTimes);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getSkillSuggestions = async (req, res, next) => {
  try {
    const { category, query } = req.query;
    const result = await aiService.getSkillSuggestions(category || '', query || '');
    res.json(result);
  } catch (err) {
    next(err);
  }
};
