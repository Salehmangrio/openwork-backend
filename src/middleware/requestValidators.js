const { body, param } = require('express-validator');

exports.createJobRules = [
  body('title').trim().isLength({ min: 5, max: 150 }).withMessage('Title must be 5-150 characters'),
  body('description').trim().isLength({ min: 20, max: 5000 }).withMessage('Description must be 20-5000 characters'),
  body('category').notEmpty().withMessage('Category is required'),
  body('budgetMin').isFloat({ min: 0 }).withMessage('budgetMin must be >= 0'),
  body('budgetMax').isFloat({ min: 0 }).withMessage('budgetMax must be >= 0'),
  body('budgetMax').custom((value, { req }) => Number(value) >= Number(req.body.budgetMin)).withMessage('budgetMax must be >= budgetMin'),
];

exports.submitProposalRules = [
  param('jobId').isMongoId().withMessage('Invalid jobId'),
  body('coverLetter').trim().isLength({ min: 20, max: 3000 }).withMessage('Cover letter must be 20-3000 characters'),
  body('bidAmount').isFloat({ min: 1 }).withMessage('bidAmount must be at least 1'),
  body('deliveryTime').trim().isLength({ min: 1, max: 100 }).withMessage('deliveryTime is required'),
];

exports.createOrderRules = [
  body('freelancerId').isMongoId().withMessage('Valid freelancerId is required'),
  body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
  body('totalAmount').isFloat({ gt: 0 }).withMessage('totalAmount must be greater than 0'),
  body('jobId').optional().isMongoId().withMessage('Invalid jobId'),
  body('offerId').optional().isMongoId().withMessage('Invalid offerId'),
];

exports.updateOrderStatusRules = [
  param('id').isMongoId().withMessage('Invalid order id'),
  body('status').optional().isIn([
    'pending_payment', 'active', 'in_progress', 'delivered',
    'under_review', 'revision_requested', 'completed', 'cancelled', 'disputed',
  ]).withMessage('Invalid status value'),
  body('deliverables').optional().isArray().withMessage('deliverables must be an array'),
  body('note').optional().isLength({ max: 1000 }).withMessage('note cannot exceed 1000 characters'),
];

exports.createPaymentIntentRules = [
  body('orderId').isMongoId().withMessage('Valid orderId is required'),
];

exports.confirmPaymentRules = [
  body('orderId').isMongoId().withMessage('Valid orderId is required'),
  body('paymentIntentId').trim().notEmpty().withMessage('paymentIntentId is required'),
];

exports.withdrawRules = [
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than 0'),
  body('method').optional().isIn(['stripe', 'paypal', 'bank', 'wallet']).withMessage('Invalid withdrawal method'),
];
