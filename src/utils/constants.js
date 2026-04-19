/**
 * utils/constants.js
 * Shared application constants and enums
 */

// User roles
const USER_ROLES = {
  CLIENT: 'client',
  FREELANCER: 'freelancer',
  ADMIN: 'admin',
};

// Job categories
const JOB_CATEGORIES = {
  WEB_DEVELOPMENT: 'web_development',
  MOBILE_APP: 'mobile_app',
  DESIGN: 'design',
  WRITING: 'writing',
  PROGRAMMING: 'programming',
  DATA_SCIENCE: 'data_science',
  AI_ML: 'ai_ml',
  CYBER_SECURITY: 'cyber_security',
  DEVOPS: 'devops',
  CLOUD: 'cloud',
  OTHER: 'other',
};

// Experience levels
const JOB_EXPERIENCE_LEVELS = {
  JUNIOR: 'junior',
  MID: 'mid',
  SENIOR: 'senior',
  EXPERT: 'expert',
  ANY: 'any',
};

// Job statuses
const JOB_STATUS = {
  OPEN: 'open',
  HIRED: 'hired',
  IN_PROGRESS: 'in_progress',
  CLOSED: 'closed',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
};

// Order statuses
const ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  ACTIVE: 'active',
  IN_PROGRESS: 'in_progress',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
};

// Proposal statuses
const PROPOSAL_STATUS = {
  PENDING: 'pending',
  SHORTLISTED: 'shortlisted',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
};

// Dispute statuses
const DISPUTE_STATUS = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  RESOLVED: 'resolved',
  PENDING_REFUND: 'pending_refund',
};

// Payment methods
const PAYMENT_METHODS = {
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
  BANK_TRANSFER: 'bank_transfer',
  WALLET: 'wallet',
  PAYPAL: 'paypal',
  STRIPE: 'stripe',
};

// Notification types
const NOTIFICATION_TYPES = {
  NEW_MESSAGE: 'new_message',
  ORDER_CREATED: 'order_created',
  ORDER_UPDATED: 'order_updated',
  PAYMENT_RELEASED: 'payment_released',
  PROPOSAL_RECEIVED: 'proposal_received',
  PROPOSAL_ACCEPTED: 'proposal_accepted',
  PROPOSAL_REJECTED: 'proposal_rejected',
  REVIEW_RECEIVED: 'review_received',
  DISPUTE_OPENED: 'dispute_opened',
  DISPUTE_RESOLVED: 'dispute_resolved',
  SKILL_TEST_PASSED: 'skill_test_passed',
  MILESTONE_SUBMITTED: 'milestone_submitted',
  WITHDRAWAL_PROCESSED: 'withdrawal_processed',
};

// Error codes for API responses
const ERROR_CODES = {
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
};

// Rate limiting tiers (for reference, primary config in middleware)
const RATE_LIMITS = {
  AUTH: { requests: 5, window: '15m' },
  GENERAL: { requests: 100, window: '15m' },
  STRICT: { requests: 10, window: '15m' },
  PAYMENT: { requests: 5, window: '30m' },
  RELAXED: { requests: 200, window: '15m' },
};

module.exports = {
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
  RATE_LIMITS,
};
