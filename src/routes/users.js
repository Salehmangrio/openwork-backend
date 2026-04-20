// routes/users.js
const express = require('express');
const r = express.Router();
const { protect } = require('../middleware/auth');
const { getUser, getFreelancers, getClients, getConversationClients, updateProfile, getDashboardStats, uploadProfileImage, deleteProfileImage } = require('../controllers/userController');
const { uploadProfileImage: uploadMiddleware } = require('../middleware/upload');
// Specific routes MUST come before /:id
r.get('/freelancers', getFreelancers);
r.get('/clients', protect, getClients);
r.get('/conversation-clients', protect, getConversationClients);
r.get('/dashboard/stats', protect, getDashboardStats);
r.put('/profile', protect, updateProfile);
r.post('/upload/profile-image', protect, uploadMiddleware, uploadProfileImage);
r.delete('/upload/profile-image', protect, deleteProfileImage);
// Generic route AFTER specific ones
r.get('/:id', getUser);
module.exports = r;
