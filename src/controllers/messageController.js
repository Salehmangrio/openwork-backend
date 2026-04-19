const { Conversation, Message } = require('../models');
const User = require('../models/User');
const { analyzeMessageContent } = require('../services/messageService');

/**
 * Get or create a conversation between two users
 */
exports.getOrCreateConversation = async (req, res, next) => {
  try {
    const { recipientId, jobId } = req.body;

    let conv = await Conversation.findOne({
      participants: { $all: [req.user._id, recipientId] },
      ...(jobId ? { job: jobId } : {}),
    }).populate('participants', 'fullName profileImage isActive');

    if (!conv) {
      conv = await Conversation.create({
        participants: [req.user._id, recipientId],
        job: jobId,
      });
      await conv.populate('participants', 'fullName profileImage isActive');
    }

    res.json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all conversations for the current user with unread counts
 */
exports.getConversations = async (req, res, next) => {
  try {
    const convs = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'fullName profileImage')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'fullName profileImage' }
      })
      .sort('-lastActivity');

    // Calculate unread count for each conversation
    const convIds = convs.map(c => c._id);
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          conversation: { $in: convIds },
          sender: { $ne: req.user._id },
          readAt: null // Unread messages have null readAt
        }
      },
      {
        $group: {
          _id: '$conversation',
          unreadCount: { $sum: 1 }
        }
      }
    ]);

    const unreadMap = {};
    unreadCounts.forEach(u => {
      unreadMap[u._id.toString()] = u.unreadCount;
    });

    const conversationsWithUnread = convs.map(conv => ({
      ...conv.toObject(),
      unreadCount: unreadMap[conv._id.toString()] || 0
    }));

    res.json({ success: true, conversations: conversationsWithUnread });
  } catch (err) {
    next(err);
  }
};

/**
 * Get messages for a conversation and mark them as read
 * Uses bulk update for performance
 */
exports.getMessages = async (req, res, next) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!conv.participants.some(p => p._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const messages = await Message.find({ conversation: req.params.conversationId })
      .populate('sender', 'fullName profileImage')
      .sort('createdAt');

    // Bulk update: Mark all unread messages from others as read
    // Uses timestamp-based approach (readAt = current timestamp)
    const updateResult = await Message.updateMany(
      {
        conversation: req.params.conversationId,
        sender: { $ne: req.user._id },
        readAt: null // Only update unread messages
      },
      {
        isRead: true,
        readAt: new Date() // Set read timestamp
      }
    );

    // If messages were marked as read, emit socket event
    if (updateResult.modifiedCount > 0) {
      const io = req.app.get('io');

      // Emit to sender that their messages were seen
      io.to(`chat:${conv._id}`).emit('messages_seen', {
        conversationId: req.params.conversationId,
        seenBy: req.user._id,
        seenAt: new Date(),
        messageCount: updateResult.modifiedCount
      });
    }

    res.json({ success: true, messages });
  } catch (err) {
    next(err);
  }
};

/**
 * Send a new message
 * Analyzes content for safety and marks as delivered when sent
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const { content, messageType = 'text', attachments } = req.body;
    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });

    // Analyze message content using AI service
    const analysis = await analyzeMessageContent(content);

    const message = await Message.create({
      conversation: conv._id,
      sender: req.user._id,
      content,
      messageType,
      attachments: attachments || [],
      deliveredAt: new Date(), // Mark as delivered when sent
      contentStatus: analysis.status,
      contentScore: analysis.score,
      flaggedAt: analysis.status === 'unsafe' ? new Date() : null
    });

    conv.lastMessage = message._id;
    conv.lastActivity = new Date();
    await conv.save();

    await message.populate('sender', 'fullName profileImage');

    // Emit socket event
    const io = req.app.get('io');
    io.to(`chat:${conv._id}`).emit('chat:message', message);

    // Notify recipient (if online)
    const recipient = conv.participants.find(p => p._id.toString() !== req.user._id.toString());
    if (recipient) {
      io.to(recipient._id.toString()).emit('notification:new', {
        type: 'new_message',
        title: `New message from ${req.user.fullName}`,
        body: content.slice(0, 100),
      });
    }

    res.status(201).json({ success: true, message });
  } catch (err) {
    next(err);
  }
};

/**
 * Get total unread message count for current user
 * Uses aggregation for performance
 */
exports.getUnreadCount = async (req, res, next) => {
  try {
    // Get all conversations the user is part of
    const convs = await Conversation.find({ participants: req.user._id }).select('_id');
    const convIds = convs.map(c => c._id);

    // Count unread messages using aggregation
    const result = await Message.aggregate([
      {
        $match: {
          conversation: { $in: convIds },
          sender: { $ne: req.user._id },
          readAt: null // Unread messages have null readAt
        }
      },
      {
        $count: 'unreadCount'
      }
    ]);

    const unreadCount = result[0]?.unreadCount || 0;

    res.json({ success: true, unreadCount });
  } catch (err) {
    next(err);
  }
};

/**
 * Open a conversation and mark messages as read
 * Emits socket event for real-time updates
 */
exports.openConversation = async (req, res, next) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId)
      .populate('participants', 'fullName profileImage')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'fullName profileImage' }
      });

    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!conv.participants.some(p => p._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Bulk update: Mark all unread messages from others as read
    const updateResult = await Message.updateMany(
      {
        conversation: req.params.conversationId,
        sender: { $ne: req.user._id },
        readAt: null
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    // Emit socket event if messages were marked as read
    if (updateResult.modifiedCount > 0) {
      const io = req.app.get('io');
      io.to(`chat:${conv._id}`).emit('messages_seen', {
        conversationId: req.params.conversationId,
        seenBy: req.user._id,
        seenAt: new Date(),
        messageCount: updateResult.modifiedCount
      });
    }

    res.json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
};

/**
 * Mark specific messages as read (for selective read status)
 * Useful for marking individual messages without opening the whole conversation
 */
exports.markMessagesAsRead = async (req, res, next) => {
  try {
    const { messageIds, conversationId } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid message IDs' });
    }

    // Verify user is part of these conversations
    const messages = await Message.find({ _id: { $in: messageIds } });
    const convIds = messages.map(m => m.conversation);

    const convs = await Conversation.find({
      _id: { $in: convIds },
      participants: req.user._id
    });

    if (convs.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Bulk update with idempotency check
    const updateResult = await Message.updateMany(
      {
        _id: { $in: messageIds },
        sender: { $ne: req.user._id },
        readAt: null
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    // Emit socket event to notify other users that messages were read
    if (updateResult.modifiedCount > 0) {
      const io = req.app.get('io');
      if (io && conversationId) {
        // Notify all participants in conversation about read status
        io.to(`chat:${conversationId}`).emit('messages_seen', {
          conversationId,
          seenBy: req.user._id,
          seenAt: new Date(),
          messageCount: updateResult.modifiedCount
        });
      }
    }

    res.json({
      success: true,
      messageCount: updateResult.modifiedCount,
      seenAt: new Date()
    });
  } catch (err) {
    next(err);
  }
};
