/**
 * middleware/validators/proposalValidators.js
 * Validation rules for proposal-related endpoints
 */

const { body, param } = require('express-validator');

// ============================================================
// Submit Proposal Validation
// ============================================================
exports.submitProposalRules = [
  param('jobId').isMongoId().withMessage('Invalid jobId'),
  body('coverLetter')
    .trim()
    .isLength({ min: 20, max: 3000 })
    .withMessage('Cover letter must be 20-3000 characters'),
  body('bidAmount')
    .isFloat({ min: 1 })
    .withMessage('bidAmount must be at least 1'),
  body('deliveryTime')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('deliveryTime is required'),
];

// ============================================================
// Get Job Proposals Validation
// ============================================================
exports.getProposalsRules = [
  param('jobId').isMongoId().withMessage('Invalid job ID'),
];

// ============================================================
// Update Proposal Status Validation
// ============================================================
exports.updateProposalStatusRules = [
  param('id').isMongoId().withMessage('Invalid proposal ID'),
  body('status')
    .optional()
    .isIn(['pending', 'accepted', 'rejected', 'withdrawn'])
    .withMessage('Invalid proposal status'),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters'),
];

// ============================================================
// Accept Proposal Validation
// ============================================================
exports.acceptProposalRules = [
  param('id').isMongoId().withMessage('Invalid proposal ID'),
];

// ============================================================
// Reject Proposal Validation
// ============================================================
exports.rejectProposalRules = [
  param('id').isMongoId().withMessage('Invalid proposal ID'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
];
