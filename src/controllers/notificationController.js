/**
 * notificationController.js
 * Notification management controllers
 */

const notificationService = require('../services/notificationService');

exports.getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const filter = req.query.filter || 'all';
    const result = await notificationService.getNotifications(req.user._id, page, limit, filter);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const result = await notificationService.markRead(req.params.id, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllRead(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const result = await notificationService.deleteNotification(req.params.id, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.deleteAllNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.deleteAllNotifications(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getPreferences = async (req, res, next) => {
  try {
    const result = await notificationService.getPreferences(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.updatePreferences = async (req, res, next) => {
  try {
    const result = await notificationService.updatePreferences(req.user._id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const result = await notificationService.getStats(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
