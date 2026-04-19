/**
 * Server Architecture Index
 * 
 * Main entry point for understanding the server structure
 * 
 * This file organizes all major components using a feature-based architecture:
 * - Features: Business domains (jobs, proposals, payments, etc.)
 * - Core: Shared infrastructure (models, middleware, utils)
 */

// ============================================================
// FEATURES (Business Domains)
// ============================================================
const features = require('./features');

// Commonly used features
const {
  jobs,
  proposals,
  orders,
  payments,
  offers,
  reviews,
  disputes,
  admin,
  dashboard,
  ai,
  notifications,
  skillTests,
  users,
  auth,
  messages,
} = features;

// ============================================================
// CORE (Shared Infrastructure)
// ============================================================
const core = require('./core');

const {
  models,
  middleware,
  utils,
  seeds,
} = core;

// ============================================================
// KEY IMPORTS FOR COMMON USAGE
// ============================================================

/**
 * Database Models
 * Usage: const { User, Job, Order } = models;
 */
const {
  User,
  Job,
  Order,
  Message,
  Conversation,
} = models;

/**
 * Authentication Middleware
 * Usage: const { protect, adminOnly } = middleware.auth;
 */
const {
  auth: authMiddleware,
  rateLimiter,
  requestValidators,
  validate: validateMiddleware,
} = middleware;

/**
 * Utility Functions
 * Usage: const { sendEmail, logActivity } = utils.helpers;
 */
const {
  helpers,
  email,
  APIFeatures,
} = utils;

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Features
  features,
  
  // Feature shortcuts
  jobs,
  proposals,
  orders,
  payments,
  offers,
  reviews,
  disputes,
  admin,
  dashboard,
  ai,
  notifications,
  skillTests,
  users,
  auth,
  messages,
  
  // Core
  core,
  
  // Core shortcuts
  models,
  middleware,
  utils,
  seeds,
  
  // Common imports
  User,
  Job,
  Order,
  Message,
  Conversation,
  authMiddleware,
  rateLimiter,
  requestValidators,
  validateMiddleware,
  helpers,
  email,
  APIFeatures,
};

/**
 * ARCHITECTURE OVERVIEW
 * 
 * The server is organized into two main areas:
 * 
 * 1. FEATURES (Business Domains)
 * ═════════════════════════════════════════════════════════════
 * Each feature contains:
 * - controller: HTTP request handling
 * - service: Business logic
 * - routes: API endpoints
 * 
 * Available features:
 * • jobs - Job posting and management
 * • proposals - Freelancer proposals
 * • orders - Order lifecycle
 * • payments - Payment processing
 * • offers - Offer marketplace
 * • reviews - User reviews & ratings
 * • disputes - Dispute resolution
 * • admin - Admin operations
 * • dashboard - User dashboards
 * • ai - AI-powered features
 * • notifications - Notification system
 * • skillTests - Skill assessments
 * • users - User management
 * • auth - Authentication
 * • messages - Real-time messaging
 * 
 * 2. CORE (Shared Infrastructure)
 * ═════════════════════════════════════════════════════════════
 * Shared infrastructure components:
 * • models - Database schemas
 * • middleware - Request processors
 * • utils - Helper functions
 * • seeds - Database initialization
 * 
 * 
 * USAGE EXAMPLES
 * ═════════════════════════════════════════════════════════════
 * 
 * Accessing a feature:
 * ────────────────────────────────────────────────────────────
 * const { jobs } = require('./src');
 * const jobController = jobs.controller;
 * const jobService = jobs.service;
 * const jobRoutes = jobs.routes;
 * 
 * Accessing core infrastructure:
 * ────────────────────────────────────────────────────────────
 * const { models, middleware, utils } = require('./src');
 * const { User, Job } = models;
 * const { protect } = middleware.auth;
 * const { sendEmail } = utils.email;
 * 
 * Direct imports (shortcuts):
 * ────────────────────────────────────────────────────────────
 * const { User, Job, Order } = require('./src');
 * const { protect, adminOnly } = require('./src').authMiddleware;
 * const { sendEmail } = require('./src').email;
 * 
 * 
 * BENEFITS
 * ═════════════════════════════════════════════════════════════
 * ✓ Clear organization by business domain
 * ✓ Easy to locate code for any feature
 * ✓ Shared infrastructure clearly separated
 * ✓ Better code discoverability
 * ✓ Simplified testing and maintenance
 * ✓ Scales well as app grows
 * ✓ Easy onboarding for new developers
 * ✓ Encourages code reuse
 * 
 * 
 * FOLDER STRUCTURE
 * ═════════════════════════════════════════════════════════════
 * 
 * src/
 * ├── features/
 * │   ├── jobs/
 * │   │   └── index.js (exports: controller, service, routes)
 * │   ├── proposals/
 * │   ├── orders/
 * │   ├── payments/
 * │   ├── offers/
 * │   ├── reviews/
 * │   ├── disputes/
 * │   ├── admin/
 * │   ├── dashboard/
 * │   ├── ai/
 * │   ├── notifications/
 * │   ├── skillTests/
 * │   ├── users/
 * │   ├── auth/
 * │   ├── messages/
 * │   └── index.js (central feature hub)
 * │
 * ├── core/
 * │   ├── models/
 * │   │   └── index.js (all database schemas)
 * │   ├── middleware/
 * │   │   └── index.js (all middleware)
 * │   ├── utils/
 * │   │   └── index.js (all utilities)
 * │   ├── seeds/
 * │   │   └── index.js (all seed files)
 * │   └── index.js (core infrastructure hub)
 * │
 * ├── controllers/ (legacy - will be deprecated)
 * ├── services/ (legacy - will be deprecated)
 * ├── routes/ (legacy - will be deprecated)
 * ├── models/ (legacy - will be deprecated)
 * ├── middleware/ (legacy - will be deprecated)
 * ├── utils/ (legacy - will be deprecated)
 * ├── socket/ (socket.io configuration)
 * ├── index.js (main server file)
 * └── package.json
 */
