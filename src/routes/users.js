const express = require('express');
const { protect } = require('../middleware/auth');
const { getUser,
    getFreelancers,
    getClients,
    getConversationClients,
    updateProfile,
    getDashboardStats,
    uploadProfileImage,
    deleteProfileImage,
    updateRoleSwitch,
    toggleDualRole
} = require('../controllers/userController');
const { uploadProfileImage: uploadMiddleware } = require('../middleware/upload');
const router = express.Router();



router.get('/freelancers', getFreelancers);
router.get('/clients', protect, getClients);
router.get('/conversation-clients', protect, getConversationClients);
router.get('/dashboard/stats', protect, getDashboardStats);
router.put('/profile', protect, updateProfile);
router.post('/upload/profile-image', protect, uploadMiddleware, uploadProfileImage);
router.delete('/upload/profile-image', protect, deleteProfileImage);
router.put('/role-switch', protect, updateRoleSwitch);
router.put('/toggle-dual-role', protect, toggleDualRole);
router.get('/:id', getUser);


module.exports = router;
