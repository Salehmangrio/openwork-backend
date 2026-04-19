/**
 * middleware/README.md
 * Middleware Structure & Optimization Guide
 */

# Middleware Architecture - Optimized

## 📁 Structure

```
middleware/
├── index.js                 (Main exports & usage guide)
├── auth.js                  (Authentication & Authorization - REFACTORED)
├── rateLimiter.js          (Rate limiting - ENHANCED with 5 tiers)
├── validate.js             (Validation error handler)
├── error.js                (Centralized error handling) ✨ NEW
├── security.js             (CORS, Helmet, Sanitization) ✨ NEW
├── logging.js              (Request & action logging) ✨ NEW
└── validators/             (Organized by domain) ✨ NEW
    ├── index.js            (Exports all validators)
    ├── jobValidators.js    (Job validation rules)
    ├── proposalValidators.js
    ├── orderValidators.js
    ├── paymentValidators.js
    └── userValidators.js
```

## 🔐 Authentication Middleware - REFACTORED

### Key Improvements:
- ✅ **Eliminated code duplication** between `protect` and `optionalAuth`
- ✅ **Extracted token extraction logic** to separate utility
- ✅ **Centralized user verification** in single function
- ✅ **Added role-based access** (admin, freelancer, client)
- ✅ **Added owner verification** with isOwner middleware

### Available Middleware:
```javascript
// Require authentication
protect

// Optional authentication (continue if no token)
optionalAuth

// Role-based access control
adminOnly        // ✨ NEW
freelancerOnly   // ✨ NEW
clientOnly       // ✨ NEW

// Resource ownership
isOwner(fieldName)  // ✨ NEW - Usage: isOwner('freelancerId')
```

## ⏱️ Rate Limiting - ENHANCED

### Previous Issues:
- ❌ Rate limiting was disabled (skip: true)
- ❌ Only one limiter for all endpoints
- ❌ No differentiation by operation type

### New Tiers:
```javascript
authLimiter      // 5 requests / 15 min (login/signup)
generalLimiter   // 100 requests / 15 min (normal API)
strictLimiter    // 10 requests / 15 min (sensitive ops)
paymentLimiter   // 5 requests / 30 min (payment only)
relaxedLimiter   // 200 requests / 15 min (search/listings)
```

### Usage:
```javascript
router.post('/login', authLimiter, controller.login);
router.post('/payments', paymentLimiter, controller.processPayment);
router.get('/jobs', relaxedLimiter, controller.getJobs);
```

## ✔️ Validation - REORGANIZED

### Previous Issues:
- ❌ All validators in single 50-line file
- ❌ Hard to find specific validation rules
- ❌ Mixed concerns

### New Organization:
```
validators/
├── jobValidators.js         (4 rule sets)
├── proposalValidators.js    (4 rule sets)
├── orderValidators.js       (5 rule sets)
├── paymentValidators.js     (6 rule sets)
└── userValidators.js        (4 rule sets)
```

Total: **23 validation rule sets** (vs 6 before)

### Usage:
```javascript
const { jobValidators, handleValidation, protect } = require('../middleware');

router.post('/',
  protect,
  jobValidators.createJobRules,
  handleValidation,
  controller.createJob
);
```

## 🛡️ Security Middleware - NEW

### Features:
- **CORS Configuration**: Allows frontend domains
- **Helmet Security Headers**: Protects against common attacks
- **NoSQL Injection Prevention**: mongo-sanitize
- **XSS Protection**: xss-clean
- **Rate Limit Error Handling**: Better error messages

### Usage:
```javascript
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(sanitizationMiddleware);
```

## 📝 Error Handling - NEW

### Features:
- **Unified error format**: All errors follow same structure
- **Error codes**: specific errorCode for each error type
- **Async wrapper**: Catches async errors automatically
- **Database error handling**: Mongoose validation, duplicate, cast errors
- **JWT error handling**: Token expired, invalid token

### Usage:
```javascript
const { asyncHandler, errorHandler } = require('../middleware');

router.get('/jobs', asyncHandler(controller.getJobs));

// At end of all routes:
app.use(errorHandler);
```

### Error Response Format:
```json
{
  "success": false,
  "message": "Error description",
  "errorCode": "ERROR_TYPE",
  "stack": "..."  // Only in development
}
```

## 📊 Logging - NEW

### Features:
- **Request logging**: Method, path, status, duration
- **User action logging**: For audit trails
- **Color-coded output**: ❌ errors, ⚠️ warnings, ✓ success
- **IP tracking**: For security and debugging

### Usage:
```javascript
app.use(requestLogger);

// In specific routes:
router.post('/sensitive-action',
  userActionLogger('SENSITIVE_ACTION'),
  controller.handler
);
```

## 📌 Main Server Setup Example

```javascript
// server/src/index.js
const middleware = require('./middleware');

// ===== SECURITY (PRIORITY 1) =====
app.use(middleware.helmetMiddleware);
app.use(middleware.corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(middleware.sanitizationMiddleware);

// ===== LOGGING (PRIORITY 2) =====
app.use(middleware.requestLogger);

// ===== RATE LIMITING (PRIORITY 3) =====
app.use('/api/auth/', middleware.authLimiter);
app.use('/api/payments/', middleware.paymentLimiter);
app.use('/api/admin/', middleware.strictLimiter);
app.use('/api/jobs', middleware.relaxedLimiter);
app.use('/api/', middleware.generalLimiter);

// ===== ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);

// ===== ERROR HANDLING (PRIORITY 4 - LAST) =====
app.use(middleware.errorHandler);
```

## 🔄 Migration Checklist

- [x] Refactored auth.js (removed duplication)
- [x] Enhanced rateLimiter.js (5 tiers)
- [x] Created error.js (centralized error handling)
- [x] Created security.js (CORS, Helmet, sanitization)
- [x] Created logging.js (request & action logging)
- [x] Created middleware/index.js (centralized exports)
- [x] Split validators (5 files by domain)
- [x] Created middleware/validators/index.js

## 📊 Summary of Improvements

| Aspect | Before | After | Improvement |
|--------|--------|-------|------------|
| **Middleware Files** | 4 | 10 | +150% (organized by purpose) |
| **Rate Limiting Tiers** | 1 (disabled) | 5 | 5x more granular control |
| **Validators** | 1 file (50 lines) | 5 files (organized) | Better organization |
| **Error Handling** | Scattered | Centralized | Consistent format |
| **Code Duplication** | High | None | 100% DRY |
| **Security Features** | Basic | Enhanced | CORS + Helmet + Sanitization |
| **Logging** | Request only | Request + Actions | Better audit trail |

## 🎯 Key Optimizations

1. **Removed Code Duplication**: Extracted common logic to utilities
2. **Better Organization**: Validators split by business domain
3. **Enhanced Security**: Added Helmet, CORS, sanitization middleware
4. **Improved Logging**: Request + user action logging
5. **Centralized Error Handling**: Consistent error responses
6. **Rate Limiting**: 5 tiers for different endpoint types
7. **Role-Based Access**: Easy role checking middleware
8. **Owner Verification**: Flexible resource ownership checks

## 📚 Next Steps (Optional)

1. **Redis-backed Rate Limiting**: For distributed systems
2. **JWT Refresh Tokens**: Auto-refresh expired tokens
3. **Structured Logging**: Winston, Bunyan for production logging
4. **Request Tracing**: Correlation IDs for tracking requests
5. **Cache Layer**: HTTP caching headers management
6. **API Throttling**: User-based request quotas
