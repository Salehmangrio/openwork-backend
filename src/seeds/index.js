/**
 * Seeds Index
 * 
 * Database seeding scripts for development and testing
 * 
 * Usage:
 * - npm run seed          (runs main seed.js)
 * - npm run seed:jobs    (seed jobs and offers)
 * - npm run seed:freelancers (seed freelancer data)
 * 
 * ⚠️ WARNING: These scripts will clear the database!
 * Only run in development environment.
 */

const seedAll = require('./seed');
const seedJobs = require('./seedJobsOffers');
const seedFreelancers = require('./seedFreelancerDummies');
const seedReviews = require('./seedFreelancerReviews');
const seedConversations = require('./seedConversations');

module.exports = {
  seedAll,
  seedJobs,
  seedFreelancers,
  seedReviews,
  seedConversations,
};
