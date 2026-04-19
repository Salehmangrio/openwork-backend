/**
 * middleware/validators/index.js
 * Centralized validator exports organized by domain
 */

module.exports = {
  // Job validators
  jobValidators: require('./jobValidators'),

  // Proposal validators
  proposalValidators: require('./proposalValidators'),

  // Order validators
  orderValidators: require('./orderValidators'),

  // Payment validators
  paymentValidators: require('./paymentValidators'),

  // User validators
  userValidators: require('./userValidators'),
};

/**
 * VALIDATOR USAGE IN ROUTES
 * ==========================
 * 
 * Example 1: Job creation with validation
 * 
 *   const { validators, handleValidation, protect } = require('../middleware');
 *   
 *   router.post('/',
 *     protect,
 *     validators.jobValidators.createJobRules,
 *     handleValidation,
 *     controller.createJob
 *   );
 * 
 * Example 2: Order update with validation
 * 
 *   router.put('/:id/status',
 *     protect,
 *     validators.orderValidators.updateOrderStatusRules,
 *     handleValidation,
 *     controller.updateOrderStatus
 *   );
 * 
 * Example 3: Payment with strict validation
 * 
 *   const { paymentLimiter, paymentValidators, handleValidation } = require('../middleware');
 *   
 *   router.post('/create-intent',
 *     protect,
 *     paymentLimiter,
 *     paymentValidators.createPaymentIntentRules,
 *     handleValidation,
 *     controller.createPaymentIntent
 *   );
 */
