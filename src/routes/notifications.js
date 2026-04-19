const express = require('express');
const r = express.Router();
const { protect } = require('../middleware/auth');
const {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
  getPreferences,
  updatePreferences,
  getStats,
} = require('../controllers/notificationController');

// Get notifications and stats
r.get('/', protect, getNotifications);
r.get('/stats', protect, getStats);

// Mark as read operations
r.put('/all/read', protect, markAllRead);
r.put('/:id/read', protect, markRead);

// Delete operations
r.delete('/:id', protect, deleteNotification);
r.delete('/', protect, deleteAllNotifications);

// Preferences management
r.get('/preferences', protect, getPreferences);
r.put('/preferences', protect, updatePreferences);

module.exports = r;
