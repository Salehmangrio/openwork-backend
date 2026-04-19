/**
 * disputeController.js
 * Dispute resolution and mediation controllers
 */

const disputeService = require('../services/disputeService');

exports.createDispute = async (req, res, next) => {
  try {
    const result = await disputeService.createDispute(req.params.orderId, req.user._id, req.body, req.ip);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.getMyDisputes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await disputeService.getDisputes(req.user._id, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getDisputeDetails = async (req, res, next) => {
  try {
    const result = await disputeService.getDisputeDetails(req.params.id, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.addDisputeMessage = async (req, res, next) => {
  try {
    const result = await disputeService.addMessage(req.params.id, req.user._id, req.body.message, req.ip);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.resolveDispute = async (req, res, next) => {
  try {
    const result = await disputeService.resolveDispute(req.params.id, req.user._id, req.body, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.assignDispute = async (req, res, next) => {
  try {
    const result = await disputeService.assignDispute(req.params.id, req.body.adminId, req.user._id, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
