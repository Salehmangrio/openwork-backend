/**
 * Core Seeds Index
 * Central exports for database seeding utilities
 */

module.exports = {
  seed: require('../../utils/seed'),
  seedConversations: require('../../utils/seedConversations'),
  seedFreelancerDummies: require('../../utils/seedFreelancerDummies'),
  seedFreelancerReviews: require('../../utils/seedFreelancerReviews'),
  seedJobsOffers: require('../../utils/seedJobsOffers'),
  seedIndex: require('../../seeddata/index'),
};
