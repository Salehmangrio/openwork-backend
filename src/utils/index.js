/**
 * Utils Index - Centralized Exports
 * 
 * Organization:
 * ✓ Helpers (notifications, logging, pagination, formatting)
 * ✓ Email (nodemailer templates and sending)
 * ✓ APIFeatures (query builder for filtering/sorting/pagination)
 * ✓ Constants (shared application constants)
 * ✓ Validators (validation helper utilities)
 */

// ============================================================
// Core Utilities
// ============================================================
const { 
  sendNotification, 
  logActivity, 
  paginate, 
  formatCurrency, 
  generateInvoiceNumber 
} = require('./helpers');

const { sendEmail } = require('./email');
const APIFeatures = require('./APIFeatures');

// ============================================================
// Constants & Configuration
// ============================================================
const {
  USER_ROLES,
  JOB_CATEGORIES,
  JOB_EXPERIENCE_LEVELS,
  JOB_STATUS,
  ORDER_STATUS,
  PROPOSAL_STATUS,
  DISPUTE_STATUS,
  PAYMENT_METHODS,
  NOTIFICATION_TYPES,
  ERROR_CODES,
} = require('./constants');

// ============================================================
// Validation Utilities
// ============================================================
const {
  validateEmail,
  validatePhoneNumber,
  validatePassword,
  validateURL,
  validateMoneyAmount,
  isValidObjectId,
} = require('./validators');

// ============================================================
// USAGE EXAMPLES
// ============================================================
/**
 * EXAMPLE 1: Send Notification
 * const { sendNotification } = require('../utils');
 * await sendNotification(userId, { 
 *   type: 'order_created',
 *   title: 'New Order Received',
 *   message: 'You have a new order'
 * });
 * 
 * EXAMPLE 2: Log Activity
 * const { logActivity } = require('../utils');
 * await logActivity(
 *   userId,
 *   'create_job',
 *   'Job',
 *   jobId,
 *   'Created job: Web Design',
 *   req.ip
 * );
 * 
 * EXAMPLE 3: Send Email
 * const { sendEmail } = require('../utils');
 * await sendEmail({
 *   to: user.email,
 *   template: 'emailVerify',
 *   data: { name: user.fullName, url: verifyUrl }
 * });
 * 
 * EXAMPLE 4: API Features (Filtering, Sorting, Pagination)
 * const { APIFeatures } = require('../utils');
 * const features = new APIFeatures(Job.find(), req.query)
 *   .filter()
 *   .sort()
 *   .paginate();
 * const jobs = await features.query;
 * 
 * EXAMPLE 5: Format Currency
 * const { formatCurrency } = require('../utils');
 * formatCurrency(1234.56) → "$1,234.56"
 * 
 * EXAMPLE 6: Generate Invoice
 * const { generateInvoiceNumber } = require('../utils');
 * generateInvoiceNumber() → "INV-1718384921234-AB3X"
 * 
 * EXAMPLE 7: Pagination
 * const { paginate } = require('../utils');
 * const { skip, limit } = paginate(req.query.page, req.query.limit);
 * 
 * EXAMPLE 8: Validation
 * const { validateEmail, validatePassword } = require('../utils');
 * validateEmail('user@example.com') → true
 * validatePassword('SecurePass123!') → true
 */

module.exports = {
  // Helpers
  sendNotification,
  logActivity,
  paginate,
  formatCurrency,
  generateInvoiceNumber,

  // Email
  sendEmail,

  // API Features
  APIFeatures,

  // Constants
  USER_ROLES,
  JOB_CATEGORIES,
  JOB_EXPERIENCE_LEVELS,
  JOB_STATUS,
  ORDER_STATUS,
  PROPOSAL_STATUS,
  DISPUTE_STATUS,
  PAYMENT_METHODS,
  NOTIFICATION_TYPES,
  ERROR_CODES,

  // Validators
  validateEmail,
  validatePhoneNumber,
  validatePassword,
  validateURL,
  validateMoneyAmount,
  isValidObjectId,
};
