/**
 * userService.js
 * User profile management and account operations
 */

const { User, Job, Order, Payment, Proposal } = require('../models/index');
const { logActivity } = require('../utils/helpers');

/**
 * Get user public profile
 * @param {ObjectId} userId - User ID
 * @returns {Object} User profile data
 */
exports.getUserProfile = async (userId) => {
  try {
    const user = await User.findById(userId)
      .select('-password -emailVerifyToken -resetPasswordToken -twoFactorSecret');

    if (!user) {
      throw new Error('User not found');
    }

    // Get user statistics if freelancer
    let stats = {};
    if (user.role === 'freelancer') {
      const [completedJobs, totalEarnings, averageCompletionTime] = await Promise.all([
        Order.countDocuments({ freelancer: userId, status: 'completed' }),
        Payment.aggregate([
          { $match: { payee: userId, status: 'released' } },
          { $group: { _id: null, total: { $sum: '$netAmount' } } },
        ]),
        Order.aggregate([
          { $match: { freelancer: userId, status: 'completed' } },
          { $group: { _id: null, avg: { $avg: { $subtract: ['$completedAt', '$createdAt'] } } } },
        ]),
      ]);

      stats = {
        completedJobs,
        totalEarnings: totalEarnings[0]?.total || 0,
        avgCompletionTime: averageCompletionTime[0]?.avg || 0,
      };
    }

    return {
      success: true,
      user: user.toObject(),
      stats,
    };
  } catch (error) {
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }
};

/**
 * Get freelancers with filtering
 * @param {Number} page - Page number
 * @param {Number} limit - Items per page
 * @param {Object} filters - Filter options
 * @returns {Object} Freelancers and pagination
 */
exports.getFreelancers = async (page = 1, limit = 12, filters = {}) => {
  try {
    const query = { role: 'freelancer', isActive: true, isBanned: false };

    if (filters.category) {
      query.skills = { $in: [filters.category] };
    }

    if (filters.skills && filters.skills.length > 0) {
      query.skills = { $in: filters.skills };
    }

    if (filters.search) {
      query.$or = [
        { fullName: { $regex: filters.search, $options: 'i' } },
        { title: { $regex: filters.search, $options: 'i' } },
        { skills: { $in: [new RegExp(filters.search, 'i')] } },
      ];
    }

    // Determine sort order
    let sort = '-aiRankScore'; // Default
    if (filters.sort === 'rating') {
      sort = '-averageRating';
    } else if (filters.sort === 'rate') {
      sort = 'hourlyRate';
    } else if (filters.sort === 'completed') {
      sort = '-completedJobs';
    } else if (filters.sort === 'newest') {
      sort = '-createdAt';
    }

    const freelancers = await User.find(query)
      .select(
        'fullName title profileImage skills hourlyRate averageRating totalReviews aiSkillScore aiRankScore completedJobs location bio experienceLevel availability'
      )
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(query);

    return {
      success: true,
      count: freelancers.length,
      total,
      pagination: { page, limit, pages: Math.ceil(total / limit) },
      freelancers,
    };
  } catch (error) {
    throw new Error(`Failed to fetch freelancers: ${error.message}`);
  }
};

/**
 * Update user profile
 * @param {ObjectId} userId - User ID
 * @param {Object} updates - Update fields
 * @returns {Object} Updated user
 */
exports.updateProfile = async (userId, updates) => {
  try {
    const allowedFields = [
      'fullName',
      'phone',
      'title',
      'bio',
      'skills',
      'hourlyRate',
      'experienceLevel',
      'portfolioUrl',
      'location',
      'languages',
      'education',
      'availability',
      'companyName',
      'organizationType',
      'notifPrefs',
      'canActAsClient',
      'canActAsFreelancer',
      'profileImage',
    ];

    const updateObject = {};
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateObject[field] = updates[field];
      }
    });

    const user = await User.findByIdAndUpdate(userId, updateObject, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      throw new Error('User not found');
    }

    // Recalculate AI rank if method exists
    if (user.recalcAIRank) {
      user.recalcAIRank();
      await user.save({ validateBeforeSave: false });
    }

    return { success: true, user };
  } catch (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }
};

/**
 * Get user dashboard statistics
 * @param {ObjectId} userId - User ID
 * @returns {Object} Dashboard statistics
 */
exports.getDashboardStats = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Get monthly earnings (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyEarnings = await Payment.aggregate([
      {
        $match: {
          payee: userId,
          type: 'order_payment',
          status: 'released',
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          amount: { $sum: '$netAmount' }, // Freelancer earnings after fees
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ]);

    // Format for chart
    const earningsMap = {};
    monthlyEarnings.forEach(item => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      earningsMap[key] = item.amount;
    });

    // Generate labels for last 6 months
    const labels = [];
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('default', { month: 'short' });
      labels.push(monthName);
      data.push(earningsMap[key] || 0);
    }

    // Get order stats
    // For totalProposals: clients get proposals received on their jobs, freelancers get proposals submitted
    const totalProposalsResult = await Proposal.aggregate([
      {
        $lookup: {
          from: 'jobs',
          localField: 'job',
          foreignField: '_id',
          as: 'jobData'
        }
      },
      {
        $match: {
          $or: [
            { freelancer: userId }, // Freelancer's own proposals
            { 'jobData.client': userId } // Proposals received on client's jobs
          ]
        }
      },
      {
        $count: 'count'
      }
    ]);

    const [activeOrders, completedOrders, totalSpent, totalEarned] = await Promise.all([
      Order.countDocuments({
        $or: [{ client: userId }, { freelancer: userId }],
        status: 'in_progress',
      }),
      Order.countDocuments({
        $or: [{ client: userId }, { freelancer: userId }],
        status: 'completed',
      }),
      Payment.aggregate([
        { $match: { payer: userId, type: 'order_payment', status: 'released' } },
        { $group: { _id: null, total: { $sum: '$grossAmount' } } }, // Client pays gross amount
      ]),
      Payment.aggregate([
        { $match: { payee: userId, type: 'order_payment', status: 'released' } },
        { $group: { _id: null, total: { $sum: '$netAmount' } } }, // Freelancer receives net amount
      ]),
    ]);

    const totalProposals = totalProposalsResult[0]?.count || 0;

    // Update user stats
    user.completedJobs = completedOrders;
    user.totalSpent = totalSpent[0]?.total || 0;
    user.totalEarned = totalEarned[0]?.total || 0;
    await user.save({ validateBeforeSave: false });

    return {
      success: true,
      stats: {
        totalJobs: user.totalJobs,
        totalSpent: user.totalSpent,
        completedJobs: user.completedJobs,
        totalEarned: user.totalEarned,
        aiSkillScore: user.aiSkillScore,
        averageRating: user.averageRating,
        activeOrders,
        totalProposals,
        monthlyEarnings: {
          labels,
          data,
        },
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch dashboard stats: ${error.message}`);
  }
};


exports.updateRoleSwitch = async (userId) => {
  try {
    const currentUser = await User.findById(userId).select('-password');

    if (!currentUser) {
      throw new Error('User not found');
    }

    if (currentUser.role === 'admin') {
      throw new Error('Admin role cannot be switched');
    }

    const canSwitch =
      currentUser.canActAsClient && currentUser.canActAsFreelancer;

    if (!canSwitch) {
      throw new Error('Role switching is only available for dual-role users');
    }

    currentUser.role =
      currentUser.role === 'freelancer' ? 'client' : 'freelancer';

    await currentUser.save();

    return {
      success: true,
      role: currentUser.role,
      user: currentUser,
    };
  } catch (error) {
    throw new Error(`Failed to switch role: ${error.message}`);
  }
};

exports.toggleDualRole = async (userId, canActAsFreelancer) => {
  try {
    const user = await User.findById(userId).select('-password');

    if (!user) {
      throw new Error('User not found');
    }

    if (user.role === 'admin') {
      throw new Error('Admin users cannot change role capabilities');
    }

    // If toggling off dual-role, ensure user has a primary role
    if (!canActAsFreelancer && !user.canActAsClient) {
      throw new Error('User must have at least one role enabled');
    }

    // Update the capability flags
    user.canActAsFreelancer = canActAsFreelancer;
    if (!canActAsFreelancer) {
      user.canActAsClient = true; // Ensure they can act as client if not freelancer
    } else {
      user.canActAsClient = true; // Enable both roles
    }

    await user.save();

    return {
      success: true,
      message: canActAsFreelancer 
        ? 'Dual role enabled! You can now work as both freelancer and client.'
        : 'Dual role disabled. You are now a client only.',
      user: user,
    };
  } catch (error) {
    throw new Error(`Failed to toggle dual role: ${error.message}`);
  }
};

