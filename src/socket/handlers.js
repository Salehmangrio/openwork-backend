/**
 * Socket.io event handlers for real-time features
 * 
 * Features:
 * - Real-time messaging with typing indicators
 * - User presence tracking
 * - Notifications
 * - Order status updates
 * - Message read receipts
 * 
 * Architecture:
 * - User joins personal room: socket.join(userId)
 * - Conversations join room: socket.join(`chat:${conversationId}`)
 * - Scalable with Redis adapter
 */

const { Message, Conversation, Notification } = require('../models');

module.exports = (io) => {
  // ===== MIDDLEWARE =====
  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
    
    if (!userId) {
      return next(new Error('Authentication error: No userId provided'));
    }

    socket.userId = userId;
    next();
  });

  // userId → Set<socket.id> (will work with Redis adapter when scaled)
  const activeUsers = new Map();

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`📱 New connection: ${socket.id} | User: ${userId}`);

    // ========================
    // 1. User Authentication & Presence
    // ========================
    // Join personal user room for targeted notifications
    socket.join(userId);

    // Track active sockets for this user
    if (!activeUsers.has(userId)) {
      activeUsers.set(userId, new Set());
    }
    activeUsers.get(userId).add(socket.id);

    console.log(`✅ User ${userId} connected (socket: ${socket.id}, total: ${activeUsers.get(userId).size})`);

    // Broadcast user online status
    io.emit('user:online', { userId, isOnline: true, timestamp: new Date() });

    // ========================
    // 2. Chat Message Handler
    // ========================
    socket.on('chat:message', async (data, callback) => {
      try {
        const { conversationId, content, messageType = 'text', attachments = [] } = data;

        // Validation
        if (!conversationId) {
          return callback?.({ success: false, error: 'conversationId required' });
        }
        if (!content || content.trim().length === 0) {
          return callback?.({ success: false, error: 'Content cannot be empty' });
        }

        // Verify user is participant in this conversation
        const conversation = await Conversation.findById(conversationId)
          .select('participants lastMessage lastActivity');

        if (!conversation) {
          return callback?.({ success: false, error: 'Conversation not found' });
        }

        const isParticipant = conversation.participants.some(p => p.toString() === userId);
        if (!isParticipant) {
          console.warn(`⚠️ User ${userId} tried to send message to unauthorized conversation ${conversationId}`);
          return callback?.({ success: false, error: 'Not authorized' });
        }

        // Create message with correct field names
        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          content: content.trim(),
          messageType,
          attachments,
          isRead: false,
          deliveredAt: new Date(), // Mark as delivered when created
        });

        // Populate sender info
        await message.populate('sender', 'fullName profileImage');

        // Update conversation lastMessage and lastActivity
        conversation.lastMessage = message._id;
        conversation.lastActivity = new Date();
        await conversation.save({ validateBeforeSave: false });

        // Calculate updated unread count for recipient
        const recipientId = conversation.participants.find(p => p.toString() !== userId);
        const unreadCount = await Message.countDocuments({
          conversation: conversationId,
          sender: { $ne: recipientId },
          readAt: null
        });

        // Emit to all participants in conversation room with unread count
        io.to(`chat:${conversationId}`).emit('chat:message.received', {
          message: message.toObject(),
          conversationId,
          unreadCount, // Include unread count for receiving user
          sender: {
            _id: userId,
            fullName: message.sender.fullName,
            profileImage: message.sender.profileImage
          }
        });

        // Send acknowledgment
        callback?.({ success: true, message });

        console.log(`💬 Message from ${userId} in ${conversationId}`);
      } catch (error) {
        console.error('❌ Message error:', error.message);
        callback?.({ success: false, error: error.message });
        socket.emit('error', { message: 'Failed to send message', error: error.message });
      }
    });

    // ========================
    // 3. Conversation Room Management
    // ========================
    socket.on('chat:join', ({ conversationId }, callback) => {
      try {
        if (!conversationId) {
          return callback?.({ success: false, error: 'conversationId required' });
        }

        socket.join(`chat:${conversationId}`);
        console.log(`👥 User ${userId} joined conversation room: chat:${conversationId}`);

        // Notify other participants
        socket.to(`chat:${conversationId}`).emit('chat:user.joined', {
          conversationId,
          userId,
          timestamp: new Date(),
        });

        callback?.({ success: true });
      } catch (error) {
        console.error('❌ Join conversation error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    socket.on('chat:leave', ({ conversationId }, callback) => {
      try {
        if (!conversationId) {
          return callback?.({ success: false, error: 'conversationId required' });
        }

        socket.leave(`chat:${conversationId}`);
        console.log(`👋 User ${userId} left conversation room: chat:${conversationId}`);

        // Notify other participants
        socket.to(`chat:${conversationId}`).emit('chat:user.left', {
          conversationId,
          userId,
          timestamp: new Date(),
        });

        callback?.({ success: true });
      } catch (error) {
        console.error('❌ Leave conversation error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ========================
    // 4. Typing Indicator
    // ========================
    socket.on('chat:typing', ({ conversationId, isTyping }, callback) => {
      try {
        if (!conversationId) {
          return callback?.({ success: false, error: 'conversationId required' });
        }

        // Broadcast to conversation room only (excludes sender)
        socket.to(`chat:${conversationId}`).emit('chat:typing.indicator', {
          conversationId,
          userId,
          isTyping,
          timestamp: new Date(),
        });

        callback?.({ success: true });
      } catch (error) {
        console.error('❌ Typing error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ========================
    // 5. Mark Messages as Read
    // ========================
    socket.on('chat:read', async ({ conversationId, messageIds }, callback) => {
      try {
        if (!conversationId || !messageIds || messageIds.length === 0) {
          return callback?.({ success: false, error: 'conversationId and messageIds required' });
        }

        // Update messages (use isRead, not is_read)
        const result = await Message.updateMany(
          { _id: { $in: messageIds } },
          { isRead: true, readAt: new Date() }
        );

        // Broadcast read receipt to others in conversation
        socket.to(`chat:${conversationId}`).emit('chat:read.notification', {
          conversationId,
          userId,
          messageIds,
          readAt: new Date(),
        });

        callback?.({ success: true, modifiedCount: result.modifiedCount });
        console.log(`✓ Read receipt: ${result.modifiedCount} messages marked by ${userId}`);
      } catch (error) {
        console.error('❌ Read error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ========================
    // 6. Notification Handler
    // ========================
    socket.on('notification:send', async ({ recipientId, type, title, message, link, sendEmail }, callback) => {
      try {
        if (!recipientId || !type || !title || !message) {
          return callback?.({ success: false, error: 'recipientId, type, title, and message are required' });
        }

        // Create notification in database using service
        const { sendNotification } = require('../utils/helpers');
        const result = await sendNotification(recipientId, {
          type,
          title,
          message,
          link: link || null,
          sender: userId, // Include sender ID
          category: 'system',
          sendEmail: sendEmail || false,
        });

        if (!result.success || !result.sent) {
          return callback?.({ 
            success: true, 
            sent: false, 
            message: result.reason || 'Notification not sent due to user preferences' 
          });
        }

        // Emit to recipient's personal room
        io.to(recipientId).emit('notification:new', {
          notification: result.notification.toObject(),
          timestamp: new Date(),
        });

        callback?.({ success: true, notification: result.notification });
        console.log(`🔔 Notification sent to ${recipientId} from ${userId}`);
      } catch (error) {
        console.error('❌ Notification error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // Mark notification as read
    socket.on('notification:read', async ({ notificationId }, callback) => {
      try {
        const notification = await Notification.findByIdAndUpdate(
          notificationId,
          { isRead: true, readAt: new Date() },
          { new: true }
        );

        callback?.({ success: true, notification });
      } catch (error) {
        console.error('❌ Notification read error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ========================
    // 7. Order Status Updates
    // ========================
    socket.on('order:status_change', async ({ orderId, newStatus, clientId, freelancerId }, callback) => {
      try {
        if (!orderId || !newStatus) {
          return callback?.({ success: false, error: 'orderId and newStatus required' });
        }

        // Verify user is either client or freelancer
        if (userId !== clientId && userId !== freelancerId) {
          return callback?.({ success: false, error: 'Not authorized to update this order' });
        }

        // Emit to client's personal room
        if (clientId) {
          io.to(clientId).emit('order:updated', {
            orderId,
            status: newStatus,
            updatedBy: userId,
            timestamp: new Date(),
          });
        }

        // Emit to freelancer's personal room
        if (freelancerId) {
          io.to(freelancerId).emit('order:updated', {
            orderId,
            status: newStatus,
            updatedBy: userId,
            timestamp: new Date(),
          });
        }

        callback?.({ success: true });
        console.log(`📦 Order ${orderId} status updated to ${newStatus}`);
      } catch (error) {
        console.error('❌ Order status update error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // Proposal status change
    socket.on('proposal:status_change', ({ proposalId, status, jobClientId }, callback) => {
      try {
        if (!jobClientId) return callback?.({ success: false, error: 'jobClientId required' });

        io.to(userId).emit('proposal:updated', {
          proposalId,
          status,
          timestamp: new Date(),
        });

        callback?.({ success: true });
      } catch (error) {
        console.error('❌ Proposal update error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    // ========================
    // 8. Disconnect Handler
    // ========================
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} | Reason: ${reason}`);

      if (!userId) return;

      const userSockets = activeUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);

        if (userSockets.size === 0) {
          // User is fully offline
          activeUsers.delete(userId);
          io.emit('user:offline', {
            userId,
            isOnline: false,
            timestamp: new Date(),
          });
          console.log(`👤 User ${userId} went fully offline (no active sockets)`);
        } else {
          // User still has other active connections
          console.log(`👤 User ${userId} has ${userSockets.size} remaining active socket(s)`);
        }
      }
    });

    // ========================
    // 9. Error Handler
    // ========================
    socket.on('error', (err) => {
      console.error(`❌ Socket error for ${userId}:`, err);
    });

    // ========================
    // 10. Reconnection Handler (for graceful recovery)
    // ========================
    socket.on('reconnect', () => {
      console.log(`🔄 User ${userId} reconnected: ${socket.id}`);
      io.emit('user:online', { userId, isOnline: true, timestamp: new Date() });
    });

    socket.on('reconnect_attempt', () => {
      console.log(`🔄 Reconnection attempt for user ${userId}`);
    });
  });

  // ===== GLOBAL HELPERS =====
  /**
   * Get count of currently active users
   * @returns {number} Number of unique users with active sockets
   */
  global.getActiveUsersCount = () => activeUsers.size;

  /**
   * Get list of currently active user IDs
   * @returns {string[]} Array of user IDs with active sockets
   */
  global.getActiveUsersList = () => Array.from(activeUsers.keys());

  /**
   * Check if a specific user is online
   * @param {string} userId - User ID to check
   * @returns {boolean} True if user has at least one active socket
   */
  global.isUserOnline = (userId) => activeUsers.has(userId);

  return { activeUsers };
};