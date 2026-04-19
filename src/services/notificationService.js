/**
 * notificationService.js
 * Handles notification lifecycle, preferences, and delivery
 * Integrates with user notification preferences and reads status
 */

const { Notification, User, ActivityLog } = require('../models/index');
const { logActivity } = require('../utils/helpers');

/**
 * Get paginated notifications for user
 * @param {ObjectId} userId - User ID
 * @param {Number} page - Page number
 * @param {Number} limit - Items per page
 * @param {String} filter - 'unread', 'read', or 'all'
 * @returns {Object} Notifications and metadata
 */
exports.getNotifications = async (userId, page = 1, limit = 50, filter = 'all') => {
  try {
    const query = { recipient: userId };

    if (filter === 'unread') query.isRead = false;
    if (filter === 'read') query.isRead = true;

    const notifications = await Notification.find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });

    return {
      success: true,
      notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      unreadCount,
    };
  } catch (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }
};

/**
 * Mark single notification as read
 * @param {ObjectId} notifId - Notification ID
 * @param {ObjectId} userId - User ID (for authorization)
 * @returns {Object} Updated notification
 */
exports.markRead = async (notifId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notifId, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notification not found or unauthorized');
    }

    return { success: true, notification };
  } catch (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
};

/**
 * Mark all unread notifications as read for user
 * @param {ObjectId} userId - User ID
 * @returns {Object} Operation result
 */
exports.markAllRead = async (userId) => {
  try {
    const result = await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return {
      success: true,
      modifiedCount: result.modifiedCount,
    };
  } catch (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
};

/**
 * Delete single notification
 * @param {ObjectId} notifId - Notification ID
 * @param {ObjectId} userId - User ID (for authorization)
 * @returns {Object} Operation result
 */
exports.deleteNotification = async (notifId, userId) => {
  try {
    const result = await Notification.findOneAndDelete({
      _id: notifId,
      recipient: userId,
    });

    if (!result) {
      throw new Error('Notification not found or unauthorized');
    }

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete notification: ${error.message}`);
  }
};

/**
 * Delete all notifications for user
 * @param {ObjectId} userId - User ID
 * @returns {Object} Operation result
 */
exports.deleteAllNotifications = async (userId) => {
  try {
    const result = await Notification.deleteMany({ recipient: userId });

    return {
      success: true,
      deletedCount: result.deletedCount,
    };
  } catch (error) {
    throw new Error(`Failed to delete notifications: ${error.message}`);
  }
};

/**
 * Create and send notification (system use)
 * @param {ObjectId} recipientId - Recipient user ID
 * @param {Object} notifData - Notification data
 * @param {String} notifData.type - Notification type (e.g., 'job_match', 'proposal_response')
 * @param {String} notifData.title - Notification title
 * @param {String} notifData.message - Notification message
 * @param {String} notifData.link - Related link/route
 * @param {String} notifData.category - Category ('system', 'proposal', 'order', 'review', 'dispute', 'message')
 * @returns {Object} Created notification
 */
exports.sendNotification = async (recipientId, notifData) => {
  try {
    // Check user notification preferences
    const user = await User.findById(recipientId).select('notifPrefs');

    if (!user) {
      throw new Error('User not found');
    }

    // Check if notification type is enabled in preferences
    const category = notifData.category || 'system';
    if (!user.notifPrefs) {
      user.notifPrefs = {};
    }

    // Default: all enabled unless explicitly disabled
    const isEnabled = user.notifPrefs[category] !== false;
    if (!isEnabled && category !== 'system') {
      // Still return success but don't create notification
      return { success: true, sent: false, reason: 'User disabled ' + category + ' notifications' };
    }

    const notification = await Notification.create({
      recipient: recipientId,
      type: notifData.type,
      title: notifData.title,
      message: notifData.message,
      link: notifData.link || null,
      category: category,
      isRead: false,
    });

    return { success: true, notification, sent: true };
  } catch (error) {
    throw new Error(`Failed to send notification: ${error.message}`);
  }
};

/**
 * Bulk send notification to multiple users
 * @param {Array} userIds - Array of user IDs
 * @param {Object} notifData - Notification data (same structure as sendNotification)
 * @returns {Object} Operation result
 */
exports.bulkSendNotifications = async (userIds, notifData) => {
  try {
    const notifications = userIds.map(userId => ({
      recipient: userId,
      type: notifData.type,
      title: notifData.title,
      message: notifData.message,
      link: notifData.link || null,
      category: notifData.category || 'system',
      isRead: false,
      createdAt: new Date(),
    }));

    const result = await Notification.insertMany(notifications);

    return {
      success: true,
      sent: result.length,
      total: userIds.length,
    };
  } catch (error) {
    throw new Error(`Failed to bulk send notifications: ${error.message}`);
  }
};

/**
 * Get user notification preferences
 * @param {ObjectId} userId - User ID
 * @returns {Object} Notification preferences
 */
exports.getPreferences = async (userId) => {
  try {
    const user = await User.findById(userId).select('notifPrefs');

    if (!user) {
      throw new Error('User not found');
    }

    // Default preferences if not set
    const preferences = user.notifPrefs || {
      messages: true,
      jobMatches: true,
      payments: true,
      disputes: true,
      marketing: false,
    };

    return { success: true, preferences };
  } catch (error) {
    throw new Error(`Failed to fetch preferences: ${error.message}`);
  }
};

/**
 * Update user notification preferences
 * @param {ObjectId} userId - User ID
 * @param {Object} preferences - Updated preferences object
 * @returns {Object} Updated preferences
 */
exports.updatePreferences = async (userId, preferences) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { notifPrefs: preferences },
      { new: true }
    ).select('notifPrefs');

    if (!user) {
      throw new Error('User not found');
    }

    return { success: true, preferences: user.notifPrefs };
  } catch (error) {
    throw new Error(`Failed to update preferences: ${error.message}`);
  }
};

/**
 * Get notification statistics for user
 * @param {ObjectId} userId - User ID
 * @returns {Object} Notification stats
 */
exports.getStats = async (userId) => {
  try {
    const [total, unread, byCategory] = await Promise.all([
      Notification.countDocuments({ recipient: userId }),
      Notification.countDocuments({ recipient: userId, isRead: false }),
      Notification.aggregate([
        { $match: { recipient: userId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    const byType = await Notification.aggregate([
      { $match: { recipient: userId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    return {
      success: true,
      stats: {
        total,
        unread,
        byCategory: Object.fromEntries(byCategory.map(c => [c._id, c.count])),
        byType: Object.fromEntries(byType.map(t => [t._id, t.count])),
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch stats: ${error.message}`);
  }
};
