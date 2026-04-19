/**
 * adminController.js
 * Admin dashboard and platform management controllers
 */

const adminService = require('../services/adminService');

exports.getDashboardStats = async (req, res, next) => {
  try {
    const result = await adminService.getDashboardStats(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      role: req.query.role,
      search: req.query.search,
      isBanned: req.query.isBanned === 'true',
      sort: req.query.sort,
    };
    const result = await adminService.getAllUsers(page, limit, filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getUserDetails = async (req, res, next) => {
  try {
    const result = await adminService.getUserDetails(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const result = await adminService.updateUser(req.params.id, req.body, req.user._id, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.suspendUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await adminService.suspendUser(req.params.id, reason, req.user._id, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getAllDisputes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status;
    const result = await adminService.getAllDisputes(page, limit, status);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getActivityLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const filters = {
      action: req.query.action,
      search: req.query.search,
    };
    const result = await adminService.getActivityLogs(page, limit, filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getPlatformAnalytics = async (req, res, next) => {
  try {
    const result = await adminService.getPlatformAnalytics();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getAprilToNowAnalytics = async (req, res, next) => {
  try {
    const result = await adminService.getAprilToNowAnalytics();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getHealthMetrics = async (req, res, next) => {
  try {
    const result = await adminService.getHealthMetrics();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.resolveDispute = async (req, res, next) => {
  try {
    const { status, resolution, refundAmount } = req.body;
    const result = await adminService.resolveDispute(req.params.id, status, resolution, refundAmount, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getAllJobs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      status: req.query.status,
      category: req.query.category,
      search: req.query.search,
    };
    const result = await adminService.getAllJobs(page, limit, filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getFraudAlerts = async (req, res, next) => {
  try {
    const result = await adminService.getFraudAlerts();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.suspendUserForFraud = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await adminService.suspendUserForFraud(req.params.id, reason, req.user._id, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getAIRankingWeights = async (req, res, next) => {
  try {
    const result = await adminService.getAIRankingWeights();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.updateAIRankingWeights = async (req, res, next) => {
  try {
    const { aiScore, rating, completion, response } = req.body;
    
    // Validate sum equals 100
    const total = aiScore + rating + completion + response;
    if (total !== 100) {
      return res.status(400).json({ 
        success: false, 
        error: `Weights must sum to 100 (currently ${total})` 
      });
    }
    
    const result = await adminService.updateAIRankingWeights(
      { aiScore, rating, completion, response },
      req.user._id,
      req.ip
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.deleteJob = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await adminService.deleteJob(
      req.params.id,
      reason || 'No reason provided',
      req.user._id,
      req.ip
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
