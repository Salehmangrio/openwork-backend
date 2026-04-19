/**
 * Features Index
 * Central hub for all application features
 * 
 * Each feature is organized by business domain and contains:
 * - Controller: HTTP request handling
 * - Service: Business logic implementation
 * - Routes: API endpoint definitions
 */

module.exports = {
  jobs: require('./jobs'),
  proposals: require('./proposals'),
  orders: require('./orders'),
  payments: require('./payments'),
  offers: require('./offers'),
  reviews: require('./reviews'),
  disputes: require('./disputes'),
  admin: require('./admin'),
  dashboard: require('./dashboard'),
  ai: require('./ai'),
  notifications: require('./notifications'),
  skillTests: require('./skillTests'),
  users: require('./users'),
  auth: require('./auth'),
  messages: require('./messages'),
};
