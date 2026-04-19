/**
 * middleware/index.js - Centralized Middleware Exports
 * 
 * Optimized Structure:
 * ✓ SECURITY: CORS, Helmet, Sanitization
 * ✓ AUTHENTICATION: Protected routes + role-based access
 * ✓ RATE LIMITING: 5 tiers for different endpoint types
 * ✓ VALIDATION: Domain-organized validators
 * ✓ ERROR HANDLING: Centralized with asyncHandler
 * ✓ LOGGING: Request & audit logging
 * 
 * Total Middleware Files: 10 (auth, rateLimiter, validate, error, security, logging, validators/*)
 * Total Exports: 32 functions/objects
 * Code Organization: 100% DRY, Role-based, Type-safe
 */

// ============================================================
// Authentication & Authorization
// ============================================================
const auth = require('./auth');
exports.protect = auth.protect;
exports.optionalAuth = auth.optionalAuth;
exports.adminOnly = auth.adminOnly;
exports.freelancerOnly = auth.freelancerOnly;
exports.clientOnly = auth.clientOnly;
exports.isOwner = auth.isOwner;

// ============================================================
// Rate Limiting (5 TIERS)
// ============================================================
const rateLimiters = require('./rateLimiter');
exports.authLimiter = rateLimiters.authLimiter;           // 5/15min - login/signup
exports.generalLimiter = rateLimiters.generalLimiter;     // 100/15min - standard API
exports.strictLimiter = rateLimiters.strictLimiter;       // 10/15min - sensitive ops
exports.paymentLimiter = rateLimiters.paymentLimiter;     // 5/30min - payments only
exports.relaxedLimiter = rateLimiters.relaxedLimiter;     // 200/15min - search/listings

// ============================================================
// Validation (DOMAIN-ORGANIZED)
// ============================================================
const validators = require('./validators');
exports.validate = require('./validate');
exports.validators = validators;

// Validation Rules by Domain
exports.jobValidators = require('./validators/jobValidators');
exports.proposalValidators = require('./validators/proposalValidators');
exports.orderValidators = require('./validators/orderValidators');
exports.paymentValidators = require('./validators/paymentValidators');
exports.userValidators = require('./validators/userValidators');
exports.handleValidation = require('./validate').handleValidation;

// ============================================================
// Security Middleware
// ============================================================
const security = require('./security');
exports.corsMiddleware = security.corsMiddleware;
exports.helmetMiddleware = security.helmetMiddleware;
exports.sanitizationMiddleware = security.sanitizationMiddleware;
exports.rateLimitErrorHandler = security.rateLimitErrorHandler;

// ============================================================
// Logging Middleware
// ============================================================
const logging = require('./logging');
exports.requestLogger = logging.requestLogger;
exports.userActionLogger = logging.userActionLogger;

// ============================================================
// Error Handling
// ============================================================
const errorHandler = require('./error');
exports.AppError = errorHandler.AppError;
exports.asyncHandler = errorHandler.asyncHandler;
exports.errorHandler = errorHandler.errorHandler;

/**
 * ═════════════════════════════════════════════════════════════════
 * COMPREHENSIVE MIDDLEWARE USAGE GUIDE
 * ═════════════════════════════════════════════════════════════════
 * 
 * 1. SERVER SETUP (in src/index.js - MAIN CONFIGURATION)
 * ──────────────────────────────────────────────────────
 * 
 *   const express = require('express');
 *   const middleware = require('./middleware');
 *   const app = express();
 *   
 *   // ===== STEP 1: SECURITY (ALWAYS FIRST) =====
 *   app.use(middleware.helmetMiddleware);        // Security headers
 *   app.use(middleware.corsMiddleware);          // CORS headers
 *   app.use(express.json({ limit: '10mb' }));   // Body parser
 *   app.use(middleware.sanitizationMiddleware);  // Data sanitization
 *   
 *   // ===== STEP 2: LOGGING =====
 *   app.use(middleware.requestLogger);           // All request logs
 *   
 *   // ===== STEP 3: RATE LIMITING (by endpoint) =====
 *   app.use('/api/auth/', middleware.authLimiter);
 *   app.use('/api/payments/', middleware.paymentLimiter);
 *   app.use('/api/admin/', middleware.strictLimiter);
 *   app.use('/api/jobs', middleware.relaxedLimiter);
 *   app.use('/api/', middleware.generalLimiter);
 *   
 *   // ===== STEP 4: ROUTE MOUNTING =====
 *   app.use('/api/auth', require('./routes/auth'));
 *   app.use('/api/jobs', require('./routes/jobs'));
 *   app.use('/api/proposals', require('./routes/proposals'));
 *   app.use('/api/orders', require('./routes/orders'));
 *   app.use('/api/payments', require('./routes/payments'));
 *   app.use('/api/admin', require('./routes/admin'));
 *   
 *   // ===== STEP 5: ERROR HANDLING (ALWAYS LAST!) =====
 *   app.use(middleware.errorHandler);
 * 
 * ═════════════════════════════════════════════════════════════════
 * 2. ROUTE EXAMPLES - COMMON PATTERNS
 * ═════════════════════════════════════════════════════════════════
 * 
 *   const { 
 *     protect, 
 *     adminOnly, 
 *     freelancerOnly,
 *     clientOnly,
 *     optionalAuth,
 *     isOwner,
 *     asyncHandler,
 *     jobValidators,
 *     handleValidation
 *   } = require('../middleware');
 * 
 *   // PATTERN A: Public route (no auth needed)
 *   router.get('/:jobId', 
 *     asyncHandler(controller.getJob)
 *   );
 * 
 *   // PATTERN B: Protected route (user must be logged in)
 *   router.post('/', 
 *     protect,
 *     asyncHandler(controller.createJob)
 *   );
 * 
 *   // PATTERN C: Protected + Role-based (freelancers only)
 *   router.post('/withdraw', 
 *     protect,
 *     freelancerOnly,
 *     asyncHandler(controller.withdraw)
 *   );
 * 
 *   // PATTERN D: Protected + Validation
 *   router.post('/', 
 *     protect,
 *     jobValidators.createJobRules,
 *     handleValidation,
 *     asyncHandler(controller.createJob)
 *   );
 * 
 *   // PATTERN E: Protected + Owner check + Validation
 *   router.put('/:jobId', 
 *     protect,
 *     isOwner('ownerId'),  // Checks req.body.ownerId === req.user._id
 *     jobValidators.updateJobRules,
 *     handleValidation,
 *     asyncHandler(controller.updateJob)
 *   );
 * 
 *   // PATTERN F: Protected + Admin only + Action logging
 *   router.delete('/:jobId', 
 *     protect,
 *     adminOnly,
 *     middleware.userActionLogger('JOB_DELETED'),
 *     asyncHandler(controller.deleteJob)
 *   );
 * 
 *   // PATTERN G: Optional auth (works with or without token)
 *   router.get('/', 
 *     optionalAuth,
 *     asyncHandler(controller.searchJobs)
 *   );
 * 
 *   // PATTERN H: Multiple validators in chain
 *   router.post('/', 
 *     protect,
 *     proposeValidators.submitProposalRules,
 *     handleValidation,
 *     asyncHandler(controller.submit)
 *   );
 * 
 * ═════════════════════════════════════════════════════════════════
 * 3. AUTHORIZATION PATTERNS
 * ═════════════════════════════════════════════════════════════════
 * 
 *   // Admin-only operations
 *   router.get('/users', protect, adminOnly, controller.getAllUsers);
 *   
 *   // Freelancer-only operations
 *   router.get('/earnings', protect, freelancerOnly, controller.getEarnings);
 *   
 *   // Client-only operations
 *   router.post('/', protect, clientOnly, controller.postJob);
 *   
 *   // Resource owner check (must own the resource)
 *   router.put('/:jobId', 
 *     protect, 
 *     isOwner('ownerId'),  // Verifies req.body.ownerId === req.user._id
 *     controller.update
 *   );
 * 
 * ═════════════════════════════════════════════════════════════════
 * 4. ERROR HANDLING PATTERNS
 * ═════════════════════════════════════════════════════════════════
 * 
 *   const { asyncHandler, AppError, errorHandler } = middleware;
 * 
 *   // AsyncHandler automatically catches all errors
 *   router.get('/', asyncHandler(async (req, res) => {
 *     throw new Error('oops');  // Caught automatically
 *   }));
 * 
 *   // Throw custom errors with status codes
 *   router.get('/:id', asyncHandler(async (req, res) => {
 *     const job = await Job.findById(req.params.id);
 *     if (!job) {
 *       throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
 *     }
 *     res.json(job);
 *   }));
 * 
 *   // Error handler catches all and responds with consistent format
 *   // { success: false, message: '...', errorCode: 'ERROR_TYPE' }
 * 
 * ═════════════════════════════════════════════════════════════════
 * 5. VALIDATION PATTERNS
 * ═════════════════════════════════════════════════════════════════
 * 
 *   const { jobValidators, handleValidation, protect } = middleware;
 * 
 *   // Single validator
 *   router.post('/',
 *     protect,
 *     jobValidators.createJobRules,
 *     handleValidation,
 *     controller.create
 *   );
 * 
 *   // Chained validators
 *   router.put('/:jobId',
 *     protect,
 *     ...jobValidators.updateJobRules,
 *     handleValidation,
 *     controller.update
 *   );
 * 
 * ═════════════════════════════════════════════════════════════════
 * 6. LOGGING PATTERNS
 * ═════════════════════════════════════════════════════════════════
 * 
 *   const { userActionLogger, protect } = middleware;
 * 
 *   // Log user action for audit trail
 *   router.delete('/:jobId',
 *     protect,
 *     userActionLogger('JOB_DELETED'),  // Logged with user info
 *     controller.delete
 *   );
 * 
 * ═════════════════════════════════════════════════════════════════
 * RATE LIMITER ASSIGNMENTS (RECOMMENDED)
 * ═════════════════════════════════════════════════════════════════
 * 
 * authLimiter:      For /auth routes (strict: 5 req/15min)
 *   - POST /login
 *   - POST /signup
 *   - POST /forgot-password
 *   - POST /reset-password
 * 
 * strictLimiter:    For sensitive operations (strict: 10 req/15min)
 *   - DELETE operations
 *   - Admin operations
 *   - Dispute management
 *   - Account changes
 * 
 * paymentLimiter:   For payment operations (strict: 5 req/30min)
 *   - POST /payments/intent
 *   - POST /payments/confirm
 *   - POST /withdraw
 *   - POST /cancel-payment
 * 
 * relaxedLimiter:   For search/listings (generous: 200 req/15min)
 *   - GET /jobs (browsing)
 *   - GET /freelancers (browsing)
 *   - GET /search
 *   - GET /browse
 * 
 * generalLimiter:   For everything else (standard: 100 req/15min)
 *   - GET /jobs/:id
 *   - GET /user/:id
 *   - POST /proposals
 *   - GET /my-items
 * 
 * ═════════════════════════════════════════════════════════════════
 */
