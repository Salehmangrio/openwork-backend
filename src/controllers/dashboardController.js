/**
 * dashboardController.js
 * User dashboard and analytics controllers
 */

const dashboardService = require('../services/dashboardService');

exports.getFreelancerDashboard = async (req, res, next) => {
  try {
    const result = await dashboardService.getFreelancerDashboard(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getClientDashboard = async (req, res, next) => {
  try {
    const result = await dashboardService.getClientDashboard(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getPerformance = async (req, res, next) => {
  try {
    const result = await dashboardService.getFreelancerPerformance(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getEarningsBreakdown = async (req, res, next) => {
  try {
    const period = req.query.period || 'month';
    const result = await dashboardService.getEarningsBreakdown(req.user._id, period);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getRecommendations = async (req, res, next) => {
  try {
    const result = await dashboardService.getRecommendations(req.user._id, req.user.role);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
