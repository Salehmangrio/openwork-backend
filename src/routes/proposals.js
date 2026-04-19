// routes/proposalRoutes.js
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { submitProposalRules } = require('../middleware/requestValidators');

const {
    submitProposal,
    getJobProposals,
    getMyProposals,
    getProposal,
    acceptProposal,
    withdrawProposal,
    rejectProposal,
} = require('../controllers/proposalController');

// =============================================
// Proposal Routes
// =============================================

/**
 * @route   GET /api/proposals/my
 * @desc    Get all proposals submitted by the logged-in freelancer
 * @access  Private
 */
router.get('/my', protect, getMyProposals);

/**
 * @route   POST /api/proposals/job/:jobId
 * @desc    Submit a new proposal for a job
 * @access  Private (Freelancer only)
 */
router.post(
    '/job/:jobId',
    protect,
    submitProposalRules,     // validation rules
    handleValidation,        // handles validation errors
    submitProposal
);

/**
 * @route   GET /api/proposals/job/:jobId
 * @desc    Get all proposals for a specific job (Client view)
 * @access  Private (Job client or Admin only)
 */
router.get('/job/:jobId', protect, getJobProposals);

/**
 * @route   PUT /api/proposals/:id/accept
 * @desc    Accept a proposal (creates an order)
 * @access  Private (Job client only)
 */
router.put('/:id/accept', protect, acceptProposal);

/**
 * @route   PUT /api/proposals/:id/reject
 * @desc    Reject a proposal (client rejects single proposal)
 * @access  Private (Job client only)
 */
router.put('/:id/reject', protect, rejectProposal);

/**
 * @route   PUT /api/proposals/:id/withdraw
 * @desc    Withdraw a proposal (freelancer can cancel their own proposal)
 * @access  Private (Proposal owner only)
 */
router.put('/:id/withdraw', protect, withdrawProposal);

/**
 * @route   GET /api/proposals/:id
 * @desc    Get a single proposal by ID
 * @access  Private (Proposal owner, job client, or admin)
 */
router.get('/:id', protect, getProposal);

module.exports = router;