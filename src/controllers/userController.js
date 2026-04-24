/**
 * userController.js
 * User profile and account management controllers
 */

const userService = require('../services/userService');
const { User, Conversation, Message } = require('../models/index');
const { cloudinary } = require('../middleware/upload');

exports.getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await userService.getUserProfile(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getFreelancers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const filters = {
      category: req.query.category,
      skills: req.query.skills ? req.query.skills.split(',') : [],
      search: req.query.search,
      sort: req.query.sort || 'aiRankScore',
    };
    const result = await userService.getFreelancers(page, limit, filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getClients = async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const limit = parseInt(req.query.limit) || 10;

    const query = { role: 'client' };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('_id fullName email profileImage')
      .limit(limit);

    res.json({
      success: true,
      users
    });
  } catch (err) {
    next(err);
  }
};

exports.getConversationClients = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const search = req.query.search || '';
    const limit = parseInt(req.query.limit) || 100;

    console.log(`🔍 [getConversationClients] Fetching all message participants for user: ${userId}`);

    // Find all conversations where current user is involved
    const conversations = await Conversation.find({ participants: userId }).populate('participants', '_id');
    const conversationIds = conversations.map(c => c._id);

    console.log(`📋 [getConversationClients] Found ${conversationIds.length} conversations`);
    console.log(`🔗 [getConversationClients] Conversation IDs:`, conversationIds);

    if (conversationIds.length === 0) {
      console.log(`⚠️ [getConversationClients] No conversations found`);
      return res.json({ success: true, users: [] });
    }

    // Extract all unique participants from conversations (everyone in those conversations except current user)
    const clientIds = new Set();

    conversations.forEach(conv => {
      console.log(`📌 [getConversationClients] Processing conversation with participants:`, conv.participants);
      conv.participants?.forEach(participant => {
        const participantId = participant._id?.toString();
        if (participantId && participantId !== userId.toString()) {
          clientIds.add(participantId);
          console.log(`➕ [getConversationClients] Added participant: ${participantId}`);
        }
      });
    });

    // Also get all unique message senders from these conversations
    const messages = await Message.find({ conversation: { $in: conversationIds } });
    console.log(`💬 [getConversationClients] Found ${messages.length} total messages`);

    messages.forEach(msg => {
      const senderId = msg.sender.toString();
      if (senderId !== userId.toString()) {
        clientIds.add(senderId);
        console.log(`💬 [getConversationClients] Added message sender: ${senderId}`);
      }
    });

    const clientIdArray = Array.from(clientIds);
    console.log(`👥 [getConversationClients] Total unique people found: ${clientIdArray.length}`, clientIdArray);

    if (clientIdArray.length === 0) {
      console.log(`⚠️ [getConversationClients] No clients found`);
      return res.json({ success: true, users: [] });
    }

    // Build query - get all these users, no role filter
    const query = { _id: { $in: clientIdArray } };
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    console.log(`🔎 [getConversationClients] Querying users with IDs:`, clientIdArray);

    const users = await User.find(query)
      .select('_id fullName email profileImage role')
      .limit(limit);

    console.log(`✅ [getConversationClients] Found ${users.length} matching users:`, users);

    res.json({
      success: true,
      users,
      total: users.length
    });
  } catch (err) {
    console.error('❌ [getConversationClients] Error:', err.message, err.stack);
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const result = await userService.updateProfile(req.user._id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getDashboardStats = async (req, res, next) => {
  try {
    const result = await userService.getDashboardStats(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please provide a profile image.',
      });
    }

    // Get current user to check for existing profile image
    const currentUser = await User.findById(req.user._id);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Delete old profile image from Cloudinary if it exists
    if (currentUser.profileImage) {
      try {
        // Extract public_id from Cloudinary URL
        // Cloudinary URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.ext
        const urlParts = currentUser.profileImage.split('/');
        const publicIdWithExt = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));
        const folder = urlParts[urlParts.length - 2];

        // Delete old image
        await cloudinary.uploader.destroy(`${folder}/${publicId}`);
      } catch (deleteErr) {
        console.error('Error deleting old profile image:', deleteErr);
        // Continue with upload even if deletion fails
      }
    }

    // Update user's profileImage with Cloudinary URL
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: req.file.path },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      profileImage: req.file.path,
      user,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteProfileImage = async (req, res, next) => {
  try {
    // Get current user
    const currentUser = await User.findById(req.user._id);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Delete profile image from Cloudinary if it exists
    if (currentUser.profileImage) {
      try {
        // Extract public_id from Cloudinary URL
        const urlParts = currentUser.profileImage.split('/');
        const publicIdWithExt = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));
        const folder = urlParts[urlParts.length - 2];

        // Delete image
        await cloudinary.uploader.destroy(`${folder}/${publicId}`);
      } catch (deleteErr) {
        console.error('Error deleting profile image:', deleteErr);
        // Continue even if deletion fails
      }
    }

    // Remove profileImage from user document
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: null },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile image deleted successfully',
      user,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateRoleSwitch = async (req, res, next) => {
  try {
    const result = await userService.updateRoleSwitch(req.user._id);

    res.status(200).json({
      success: true,
      message: `Role switched successfully to ${result.role}`,
      role: result.role,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
};

exports.toggleDualRole = async (req, res, next) => {
  try {
    const { canActAsFreelancer } = req.body;
    const result = await userService.toggleDualRole(req.user._id, canActAsFreelancer);

    res.status(200).json({
      success: true,
      message: result.message,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
};