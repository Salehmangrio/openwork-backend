/**
 * middleware/validators/userValidators.js
 * Validation rules for user-related endpoints
 */

const { body, param } = require('express-validator');

// ============================================================
// Update Profile Validation
// ============================================================
exports.updateProfileRules = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2-100 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email address'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Bio cannot exceed 2000 characters'),
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  body('hourlyRate')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Hourly rate must be at least 1'),
  body('experienceLevel')
    .optional()
    .isIn(['junior', 'mid', 'senior', 'expert'])
    .withMessage('Invalid experience level'),
];

// ============================================================
// Get User By ID Validation
// ============================================================
exports.getUserRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID'),
];

// ============================================================
// Get Freelancers List Validation
// ============================================================
exports.getFreelancersRules = [
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be at least 1'),
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  body('minRating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Rating must be between 0 and 5'),
];
