/**
 * skillTestController.js
 * Skill test and certification management controllers
 */

const skillTestService = require('../services/skillTestService');

exports.generateSkillTest = async (req, res, next) => {
  try {
    const { topic, level } = req.query;
    const result = await skillTestService.generateSkillTest(topic, level);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.evaluateSkillTest = async (req, res, next) => {
  try {
    const { topic, questions } = req.body;
    const result = await skillTestService.evaluateSkillTest(req.user._id, topic, questions, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.submitSkillTest = async (req, res, next) => {
  try {
    const { skill, answers, questions } = req.body;
    const result = await skillTestService.submitSkillTest(req.user._id, skill, answers, questions, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getCertifications = async (req, res, next) => {
  try {
    const result = await skillTestService.getCertifications(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
