// ============================================================
// utils/helpers.js — Shared utility functions
// ============================================================
const { Notification, ActivityLog, User } = require('../models/index');

exports.sendNotification = async (userId, data) => {
  try {
    // Validate required fields
    if (!userId || !data.type || !data.title || !data.message) {
      throw new Error('Missing required fields: userId, type, title, message');
    }

    // Check user notification preferences
    const user = await User.findById(userId).select('notifPrefs');
    if (!user) {
      throw new Error('User not found');
    }

    // Determine preference category
    const category = data.category || 'system';
    
    // Check if notification type is enabled in preferences
    const userPrefs = user.notifPrefs || {};
    
    // Default: all enabled unless explicitly disabled (except marketing, disabled by default)
    const isEnabled = userPrefs[category] !== false;
    
    if (!isEnabled && category !== 'system') {
      // Don't create notification if preference is disabled (unless it's system)
      return { success: true, sent: false, reason: `User disabled ${category} notifications` };
    }

    // Create notification
    const notif = await Notification.create({
      recipient: userId,
      sender: data.sender || null,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link || null,
      category: category,
      metadata: data.metadata || null,
      sendEmail: data.sendEmail || false,
      isRead: false,
    });

    return { success: true, notification: notif, sent: true };
  } catch (err) {
    console.error('Notification error:', err.message);
    throw err; // Propagate error instead of silently failing
  }
};


exports.logActivity = async (userId, action, resource, resourceId, details, ip, isAdminAction = false) => {
  try {
    await ActivityLog.create({ user: userId, action, resource, resourceId, details, ip, isAdminAction });
  } catch (err) {
    console.error('Log error:', err.message);
  }
};

exports.paginate = (page = 1, limit = 12) => ({
  skip: (page - 1) * limit,
  limit: parseInt(limit),
});

exports.formatCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

exports.generateInvoiceNumber = () =>
  `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
