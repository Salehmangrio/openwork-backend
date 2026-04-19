/**
 * Core Module Index
 * Central hub for all core infrastructure
 * 
 * Contains:
 * - Models: Database schemas
 * - Middleware: Request processing
 * - Utils: Helper functions
 * - Seeds: Database initialization
 */

module.exports = {
  models: require('./models'),
  middleware: require('./middleware'),
  utils: require('./utils'),
  seeds: require('./seeds'),
};
