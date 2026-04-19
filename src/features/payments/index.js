/**
 * Payments Feature Module
 * Organized exports for payment management
 */

module.exports = {
  controller: require('../../controllers/paymentController'),
  service: require('../../services/paymentService'),
  routes: require('../../routes/payments'),
};
