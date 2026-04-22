// ============================================================
// controllers/proposalController.js — Proposal management with services
// ============================================================
const proposalService = require('../services/proposalService');

/**
 * SUBMIT PROPOSAL
 * @route   POST /api/jobs/:jobId/proposals
 * @access  Private (Freelancer)
 */
exports.submitProposal = async (req, res, next) => {
  try {
    if (req.user.role !== 'freelancer' && !req.user.canActAsFreelancer) {
      return res.status(403).json({ success: false, message: 'Only freelancers can submit proposals' });
    }

    const { coverLetter, bidAmount, deliveryTime, isAIGenerated = false, attachments = [] } = req.body;

    // Create proposal (validation done in service)
    const proposal = await require('../models/index').Proposal.create({
      job: req.params.jobId,
      freelancer: req.user._id,
      coverLetter,
      bidAmount,
      deliveryTime,
      isAIGenerated,
      attachments,
      status: 'pending',
    });

    // Increment job proposal count
    const Job = require('../models/Job');
    await Job.findByIdAndUpdate(req.params.jobId, { $inc: { proposalCount: 1 } });

    res.status(201).json({ success: true, proposal });
  } catch (err) {
    next(err);
  }
};

/**
 * CHECK IF USER HAS APPLIED TO JOB
 * @route   GET /api/proposals/job/:jobId/check
 * @access  Private
 */
exports.checkUserApplied = async (req, res, next) => {
  try {
    const result = await proposalService.checkUserApplied(req.params.jobId, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET JOB PROPOSALS
 * @route   GET /api/jobs/:jobId/proposals
 * @access  Private (Job client)
 */
exports.getJobProposals = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const result = await proposalService.getJobProposals(req.params.jobId, req.user._id, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET MY PROPOSALS
 * @route   GET /api/proposals/my-proposals
 * @access  Private (Freelancer)
 */
exports.getMyProposals = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const result = await proposalService.getMyProposals(req.user._id, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * ACCEPT PROPOSAL
 * @route   POST /api/proposals/:id/accept
 * @access  Private (Job client)
 * 
 * CRITICAL: This triggers the entire Proposal → Order → Payment flow with:
 * - Cascade rejection of other proposals
 * - Order creation
 * - Payment escrow
 * - User stats updates
 */
exports.acceptProposal = async (req, res, next) => {
  try {
    const result = await proposalService.acceptProposal(req.params.id, req.user._id, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * WITHDRAW PROPOSAL
 * @route   POST /api/proposals/:id/withdraw
 * @access  Private (Freelancer)
 */
exports.withdrawProposal = async (req, res, next) => {
  try {
    const result = await proposalService.withdrawProposal(req.params.id, req.user._id, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * REJECT PROPOSAL
 * @route   PUT /api/proposals/:id/reject
 * @access  Private (Job client)
 * 
 * Allows client to reject a single proposal without affecting others
 */
exports.rejectProposal = async (req, res, next) => {
  try {
    const result = await proposalService.rejectProposal(req.params.id, req.user._id, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET PROPOSAL DETAILS
 * @route   GET /api/proposals/:id
 * @access  Private
 */
exports.getProposal = async (req, res, next) => {
  try {
    const Proposal = require('../models/index').Proposal;
    const proposal = await Proposal.findById(req.params.id)
      .populate('freelancer', 'fullName email title averageRating completedJobs hourlyRate')
      .populate('job', 'title description budgetMin budgetMax category client')
      .populate('job.client', 'fullName email companyName');

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    // Authorization check
    const isFreelancer = proposal.freelancer._id.toString() === req.user._id.toString();
    const isClient = proposal.job.client._id.toString() === req.user._id.toString();

    if (!isFreelancer && !isClient && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, proposal });
  } catch (err) {
    next(err);
  }
};
