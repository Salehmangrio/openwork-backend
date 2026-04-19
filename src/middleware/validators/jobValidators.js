/**
 * middleware/validators/jobValidators.js
 * Validation rules for job-related endpoints
 */

const { body, param } = require('express-validator');

// ============================================================
// Create Job Validation
// ============================================================
exports.createJobRules = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 150 })
    .withMessage('Title must be 5-150 characters'),
  body('description')
    .trim()
    .isLength({ min: 20, max: 5000 })
    .withMessage('Description must be 20-5000 characters'),
  body('category')
    .notEmpty()
    .withMessage('Category is required'),
  body('budgetMin')
    .isFloat({ min: 0 })
    .withMessage('budgetMin must be >= 0'),
  body('budgetMax')
    .isFloat({ min: 0 })
    .withMessage('budgetMax must be >= 0'),
  body('budgetMax')
    .custom((value, { req }) => Number(value) >= Number(req.body.budgetMin))
    .withMessage('budgetMax must be >= budgetMin'),
  body('requiredSkills')
    .optional()
    .isArray()
    .withMessage('requiredSkills must be an array'),
  body('experienceLevel')
    .optional()
    .isIn(['junior', 'mid', 'senior', 'expert', 'any'])
    .withMessage('Invalid experience level'),
];

// ============================================================
// Update Job Validation
// ============================================================
exports.updateJobRules = [
  param('id').isMongoId().withMessage('Invalid job ID'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 150 })
    .withMessage('Title must be 5-150 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 20, max: 5000 })
    .withMessage('Description must be 20-5000 characters'),
  body('status')
    .optional()
    .isIn(['open', 'in_progress', 'completed', 'closed', 'paused'])
    .withMessage('Invalid job status'),
];

// ============================================================
// Get Job By ID Validation
// ============================================================
exports.getJobRules = [
  param('id').isMongoId().withMessage('Invalid job ID'),
];

// ============================================================
// Close Job Validation
// ============================================================
exports.closeJobRules = [
  param('id').isMongoId().withMessage('Invalid job ID'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
];
