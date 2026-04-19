/**
 * Core Models Index
 * Central exports for all data models
 */

module.exports = {
  Job: require('../../models/Job'),
  Message: require('../../models/Message'),
  Conversation: require('../../models/Conversation'),
  ...require('../../models/sdsModels'),
  // Main index with all models
  ...require('../../models/index'),
};
