/**
 * Jobs Feature Module
 * Organized exports for job management
 */

module.exports = {
  controller: require('../../controllers/jobController'),
  service: require('../../services/jobService'),
  routes: require('../../routes/jobs'),
};
