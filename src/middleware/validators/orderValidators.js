/**
 * middleware/validators/orderValidators.js
 * Validation rules for order-related endpoints
 */

const { body, param } = require('express-validator');

// ============================================================
// Create Order Validation
// ============================================================
exports.createOrderRules = [
  body('freelancerId')
    .isMongoId()
    .withMessage('Valid freelancerId is required'),
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be 3-200 characters'),
  body('totalAmount')
    .isFloat({ gt: 0 })
    .withMessage('totalAmount must be greater than 0'),
  body('jobId')
    .optional()
    .isMongoId()
    .withMessage('Invalid jobId'),
  body('offerId')
    .optional()
    .isMongoId()
    .withMessage('Invalid offerId'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
];

// ============================================================
// Update Order Status Validation
// ============================================================
exports.updateOrderStatusRules = [
  param('id').isMongoId().withMessage('Invalid order id'),
  body('status')
    .optional()
    .isIn([
      'pending_payment', 'active', 'in_progress', 'delivered',
      'under_review', 'revision_requested', 'completed', 'cancelled', 'disputed',
    ])
    .withMessage('Invalid status value'),
  body('deliverables')
    .optional()
    .isArray()
    .withMessage('deliverables must be an array'),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('note cannot exceed 1000 characters'),
];

// ============================================================
// Get Order By ID Validation
// ============================================================
exports.getOrderRules = [
  param('id').isMongoId().withMessage('Invalid order ID'),
];

// ============================================================
// Cancel Order Validation
// ============================================================
exports.cancelOrderRules = [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
];

// ============================================================
// Submit Deliverable Validation
// ============================================================
exports.submitDeliverableRules = [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('deliverables')
    .isArray({ min: 1 })
    .withMessage('At least one deliverable is required'),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Note cannot exceed 1000 characters'),
];
