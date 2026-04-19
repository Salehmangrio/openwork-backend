/**
 * reviewController.js
 * Review and rating management controllers
 */

const reviewService = require('../services/reviewService');

exports.createReview = async (req, res, next) => {
  try {
    const result = await reviewService.createReview(req.params.orderId, req.user._id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.getUserReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await reviewService.getUserReviews(req.params.userId, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.updateReview = async (req, res, next) => {
  try {
    const result = await reviewService.updateReview(req.params.id, req.user._id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.deleteReview = async (req, res, next) => {
  try {
    const result = await reviewService.deleteReview(req.params.id, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getMyReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await reviewService.getUserReviews(req.user._id, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getMyGivenReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await reviewService.getMyGivenReviews(req.user._id, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getOfferReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await reviewService.getOfferReviews(req.params.offerId, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
