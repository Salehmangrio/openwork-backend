/**
 * middleware/validators/paymentValidators.js
 * Validation rules for payment-related endpoints
 */

const { body, param } = require('express-validator');

// ============================================================
// Create Payment Intent Validation
// ============================================================
exports.createPaymentIntentRules = [
  body('orderId')
    .isMongoId()
    .withMessage('Valid orderId is required'),
  body('amount')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('amount must be greater than 0'),
];

// ============================================================
// Confirm Payment Validation
// ============================================================
exports.confirmPaymentRules = [
  body('orderId')
    .isMongoId()
    .withMessage('Valid orderId is required'),
  body('paymentIntentId')
    .trim()
    .notEmpty()
    .withMessage('paymentIntentId is required'),
];

// ============================================================
// Request Withdrawal Validation
// ============================================================
exports.withdrawRules = [
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('amount must be greater than 0'),
  body('method')
    .optional()
    .isIn(['stripe', 'paypal', 'bank', 'wallet'])
    .withMessage('Invalid withdrawal method'),
  body('bankDetails')
    .optional()
    .if(() => arguments[0].method === 'bank')
    .notEmpty()
    .withMessage('Bank details required for bank transfers'),
];

// ============================================================
// Add Payment Method Validation
// ============================================================
exports.addPaymentMethodRules = [
  body('type')
    .isIn(['card', 'bank', 'PayPal'])
    .withMessage('Invalid payment method type'),
  body('cardNumber')
    .optional()
    .if(() => arguments[0].type === 'card')
    .isCreditCard()
    .withMessage('Invalid card number'),
];

// ============================================================
// Delete Payment Method Validation
// ============================================================
exports.deletePaymentMethodRules = [
  param('methodId')
    .isMongoId()
    .withMessage('Invalid payment method ID'),
];

// ============================================================
// Set Default Payment Method Validation
// ============================================================
exports.setDefaultPaymentMethodRules = [
  param('methodId')
    .isMongoId()
    .withMessage('Invalid payment method ID'),
];
