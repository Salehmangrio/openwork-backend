const express = require('express');
const router = express.Router();

const { protect, optionalAuth } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { createJobRules } = require('../middleware/requestValidators');

const jobController = require('../controllers/jobController');

router.get('/', optionalAuth, jobController.getJobs);
router.post('/', protect, createJobRules, handleValidation, jobController.createJob);
router.get('/my', protect, jobController.getMyJobs);
router.get('/:id', optionalAuth, jobController.getJob);
router.put('/:id', protect, jobController.updateJob);
router.delete('/:id', protect, jobController.deleteJob);

module.exports = router;

