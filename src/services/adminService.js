
const { User, Dispute, Order, Job, Payment, ActivityLog, Review, Proposal } = require('../models/index');
const { logActivity } = require('../utils/helpers');

/**
 * Get admin dashboard statistics
 * @param {ObjectId} adminId - Admin user ID (for audit logging)
 * @returns {Object} Dashboard statistics
 */
exports.getDashboardStats = async (adminId) => {
  try {
    const [
      totalUsers,
      activeFreelancers,
      activeClients,
      activeJobs,
      totalOrders,
      completedOrders,
      openDisputes,
      pendingDisputes,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'freelancer', isBanned: false }),
      User.countDocuments({ role: 'client', isBanned: false }),
      Job.countDocuments({ status: 'open' }),
      Order.countDocuments(),
      Order.countDocuments({ status: 'completed' }),
      Dispute.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
      Dispute.countDocuments({ status: 'pending' }),
    ]);

    const revenueResult = await Payment.aggregate([
      { $match: { status: { $in: ['released', 'held_in_escrow'] }, type: 'order_payment' } },
      { $group: { _id: null, total: { $sum: '$grossAmount' }, fees: { $sum: '$platformFee' } } },
    ]);

    const revenue = revenueResult[0] || { total: 0, fees: 0 };

    // Growth over last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsers = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    const newJobs = await Job.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    const newOrders = await Order.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    // Completion rate (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentOrders = await Order.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
    const recentCompleted = await Order.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      status: 'completed',
    });
    const completionRate = recentOrders > 0 ? Math.round((recentCompleted / recentOrders) * 100) : 0;

    await logActivity(
      adminId,
      'admin_view_dashboard',
      'Admin',
      null,
      'Admin accessed dashboard',
      '0.0.0.0',
      false
    );

    return {
      success: true,
      stats: {
        users: { total: totalUsers, active: activeFreelancers + activeClients, freelancers: activeFreelancers, clients: activeClients },
        jobs: { active: activeJobs },
        orders: { total: totalOrders, completed: completedOrders, completionRate },
        disputes: { open: openDisputes, pending: pendingDisputes },
        revenue: { total: revenue.total, platformFees: revenue.fees },
        growth: { newUsers, newJobs, newOrders },
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch dashboard stats: ${error.message}`);
  }
};

/**
 * Get all users with filtering and pagination
 * @param {Number} page - Page number
 * @param {Number} limit - Items per page
 * @param {Object} filters - Filter options
 * @param {String} filters.role - 'freelancer', 'client', or null
 * @param {String} filters.search - Search by name or email
 * @param {Boolean} filters.isBanned - Filter by ban status
 * @param {String} filters.sort - Sort field ('-createdAt', 'averageRating', etc)
 * @returns {Object} Users and pagination info
 */
exports.getAllUsers = async (page = 1, limit = 20, filters = {}) => {
  try {
    const query = {};

    if (filters.role) query.role = filters.role;
    if (filters.isBanned !== undefined) query.isBanned = filters.isBanned;

    if (filters.search) {
      query.$or = [
        { fullName: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const sort = filters.sort || '-createdAt';

    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(query);

    return {
      success: true,
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }
};

/**
 * Get detailed user profile (admin view)
 * @param {ObjectId} userId - User ID to view
 * @returns {Object} Detailed user profile
 */
exports.getUserDetails = async (userId) => {
  try {
    const user = await User.findById(userId).select('-password');
    if (!user) throw new Error('User not found');

    // Get user statistics
    const [jobsPosted, jobsCompleted, proposalsSent, ordersMade, averageCompletionTime, totalEarnings] = await Promise.all([
      Job.countDocuments({ client: userId }),
      Job.countDocuments({ client: userId, status: 'completed' }),
      require('./proposalService').getCountForUser ? Order.countDocuments({ freelancer: userId }) : 0,
      Order.countDocuments({ $or: [{ client: userId }, { freelancer: userId }] }),
      Order.aggregate([
        { $match: { $or: [{ client: userId }, { freelancer: userId }], status: 'completed' } },
        {
          $group: {
            _id: null,
            avg: { $avg: { $subtract: ['$completedAt', '$createdAt'] } },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { payee: userId, status: 'released' } },
        { $group: { _id: null, total: { $sum: '$netAmount' } } },
      ]),
    ]);

    const avgTime = averageCompletionTime[0]?.avg || 0;
    const earnings = totalEarnings[0]?.total || 0;

    return {
      success: true,
      user: {
        ...user.toObject(),
        stats: {
          jobsPosted,
          jobsCompleted,
          ordersMade,
          averageCompletionTimeMs: Math.round(avgTime),
          totalEarnings: earnings,
        },
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch user details: ${error.message}`);
  }
};

/**
 * Update user (ban, verify, role change)
 * @param {ObjectId} targetUserId - User to update
 * @param {Object} updates - Update object
 * @param {Boolean} updates.isBanned - Ban status
 * @param {String} updates.banReason - Reason for ban
 * @param {Boolean} updates.isVerified - Verification status
 * @param {String} updates.role - New role
 * @param {ObjectId} adminId - Admin performing action
 * @param {String} ip - Admin IP address
 * @returns {Object} Updated user
 */
exports.updateUser = async (targetUserId, updates, adminId, ip) => {
  try {
    const user = await User.findByIdAndUpdate(targetUserId, updates, {
      new: true,
    }).select('-password');

    if (!user) throw new Error('User not found');

    const action = [];
    if (updates.isBanned !== undefined) action.push(updates.isBanned ? 'banned' : 'unbanned');
    if (updates.isVerified !== undefined) action.push(updates.isVerified ? 'verified' : 'unverified');
    if (updates.role) action.push(`role changed to ${updates.role}`);

    await logActivity(
      adminId,
      'admin_update_user',
      'User',
      targetUserId,
      `Admin ${action.join(', ')}: ${user.email}. Reason: ${updates.banReason || 'N/A'}`,
      ip,
      true
    );

    return { success: true, user };
  } catch (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }
};

/**
 * Suspend/ban user account
 * @param {ObjectId} userId - User ID to ban
 * @param {String} reason - Ban reason
 * @param {ObjectId} adminId - Admin performing action
 * @param {String} ip - Admin IP
 * @returns {Object} Result
 */
exports.suspendUser = async (userId, reason, adminId, ip) => {
  try {
    return await this.updateUser(userId, { isBanned: true, banReason: reason }, adminId, ip);
  } catch (error) {
    throw new Error(`Failed to suspend user: ${error.message}`);
  }
};

/**
 * Get all disputes with filtering
 * @param {Number} page - Page number
 * @param {Number} limit - Items per page
 * @param {String} status - Filter by status ('pending', 'under_review', 'resolved')
 * @returns {Object} Disputes and pagination
 */
exports.getAllDisputes = async (page = 1, limit = 50, status = null) => {
  try {
    const query = status ? { status } : {};

    const disputes = await Dispute.find(query)
      .populate('order', 'title grossAmount -_id')
      .populate('raisedBy', 'fullName email -_id')
      .populate('against', 'fullName email -_id')
      .populate('assignedAdmin', 'fullName email -_id')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Dispute.countDocuments(query);

    return {
      success: true,
      disputes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    throw new Error(`Failed to fetch disputes: ${error.message}`);
  }
};

/**
 * Get activity logs with filtering
 * @param {Number} page - Page number
 * @param {Number} limit - Items per page
 * @param {Object} filters - Filter options
 * @param {String} filters.action - Filter by action type
 * @param {String} filters.search - Search by user email
 * @returns {Object} Activity logs and pagination
 */
exports.getActivityLogs = async (page = 1, limit = 100, filters = {}) => {
  try {
    const query = {};

    if (filters.action) query.action = filters.action;

    if (filters.search) {
      const users = await User.find({
        email: { $regex: filters.search, $options: 'i' },
      }).select('_id');
      query.user = { $in: users.map(u => u._id) };
    }

    const logs = await ActivityLog.find(query)
      .populate('user', 'fullName email')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await ActivityLog.countDocuments(query);

    return {
      success: true,
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    throw new Error(`Failed to fetch activity logs: ${error.message}`);
  }
};

/**
 * Get platform analytics
 * @returns {Object} Comprehensive analytics
 */
exports.getPlatformAnalytics = async () => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // User growth (monthly)
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Revenue by month
    const revenueByMonth = await Payment.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, type: 'order_payment' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$grossAmount' },
          fees: { $sum: '$platformFee' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Category distribution
    const categoryDist = await Job.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, avgBudget: { $avg: '$budget' } } },
      { $sort: { count: -1 } },
    ]);

    // Freelancer vs Client distribution
    const userDistribution = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    // Top rated freelancers
    const topFreelancers = await User.find({ role: 'freelancer' })
      .sort('-averageRating')
      .select('fullName averageRating totalReviews')
      .limit(10);

    // Order completion stats
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgValue: { $avg: '$grossAmount' },
        },
      },
    ]);

    // Calculate key metrics for stats
    const allOrders = await Order.find().select('grossAmount createdAt completedAt status');
    const avgJobValue = allOrders.length > 0 
      ? allOrders.reduce((sum, o) => sum + (o.grossAmount || 0), 0) / allOrders.length 
      : 0;

    const completedOrders = allOrders.filter(o => 
      o.status === 'completed' && o.completedAt && o.createdAt
    );
    const avgDeliveryDays = completedOrders.length > 0
      ? completedOrders.reduce((sum, o) => {
        const days = (new Date(o.completedAt) - new Date(o.createdAt)) / (1000 * 60 * 60 * 24);
        return sum + (isNaN(days) ? 0 : days);
      }, 0) / completedOrders.length
      : 0;

    // Proposal stats
    const allProposals = await Proposal.countDocuments();
    const acceptedProposals = await Proposal.countDocuments({ status: 'accepted' });
    const proposalAcceptanceRate = allProposals > 0 ? acceptedProposals / allProposals : 0;

    // Client return rate - clients who placed multiple orders
    const clientOrderCounts = await Order.aggregate([
      { $group: { _id: '$client', orderCount: { $sum: 1 } } },
      { $match: { orderCount: { $gte: 2 } } },
    ]);
    const totalClients = await User.countDocuments({ role: 'client' });
    const clientReturnRate = totalClients > 0 ? clientOrderCounts.length / totalClients : 0;

    return {
      success: true,
      analytics: {
        userGrowth,
        revenueByMonth,
        categoryDist,
        userDistribution: Object.fromEntries(
          userDistribution.map(u => [u._id, u.count])
        ),
        topFreelancers,
        orderStats: Object.fromEntries(
          orderStats.map(o => [o._id, { count: o.count, avgValue: o.avgValue }])
        ),
        stats: {
          avgJobValue,
          proposalAcceptanceRate,
          clientReturnRate,
          avgDeliveryDays,
        },
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch analytics: ${error.message}`);
  }
};

/**
 * Get analytics from April till now (current month)
 * @returns {Object} Analytics data for April onwards
 */
exports.getAprilToNowAnalytics = async () => {
  try {
    // Get April 1st of current year
    const currentYear = new Date().getFullYear();
    const aprilStart = new Date(currentYear, 3, 1); // Month is 0-indexed, so 3 = April

    // Revenue from April onwards (only completed orders)
    const revenueByMonth = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: aprilStart },
          type: 'order_payment',
          status: { $in: ['released', 'held_in_escrow'] }
        }
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$grossAmount' },
          fees: { $sum: '$platformFee' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // User growth from April onwards
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: aprilStart } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Order stats from April onwards
    const orderStats = await Order.aggregate([
      { $match: { createdAt: { $gte: aprilStart } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgValue: { $avg: '$grossAmount' },
        },
      },
    ]);

    return {
      success: true,
      analytics: {
        revenueByMonth,
        userGrowth,
        orderStats: Object.fromEntries(
          orderStats.map(o => [o._id, { count: o.count, avgValue: o.avgValue }])
        ),
        periodStart: aprilStart,
        periodEnd: new Date(),
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch April-to-now analytics: ${error.message}`);
  }
};

/**
 * Get platform health metrics
 * @returns {Object} Platform health status
 */
exports.getHealthMetrics = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      activeUsersToday,
      newJobsToday,
      completedOrdersToday,
      disputes,
      avgJobCompletion,
    ] = await Promise.all([
      User.countDocuments({ lastLogin: { $gte: today, $lt: tomorrow } }),
      Job.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      Order.countDocuments({ status: 'completed', completedAt: { $gte: today, $lt: tomorrow } }),
      Dispute.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
      Order.aggregate([
        {
          $group: {
            _id: null,
            avgDays: {
              $avg: {
                $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 86400000],
              },
            },
          },
        },
      ]),
    ]);

    const health = {
      activeUsersToday,
      newJobsToday,
      completedOrdersToday,
      pendingDisputes: disputes,
      avgCompletionDays: Math.round(avgJobCompletion[0]?.avgDays || 0),
    };

    return { success: true, health };
  } catch (error) {
    throw new Error(`Failed to fetch health metrics: ${error.message}`);
  }
};

/**
 * Resolve a dispute
 * @param {ObjectId} disputeId - Dispute ID
 * @param {String} status - Resolution status ('resolved_freelancer' or 'resolved_client')
 * @param {String} resolution - Resolution description
 * @param {Number} refundAmount - Amount to refund (if resolving for client)
 * @param {ObjectId} adminId - Admin performing action
 * @returns {Object} Result
 */
exports.resolveDispute = async (disputeId, status, resolution, refundAmount, adminId) => {
  try {
    const dispute = await Dispute.findById(disputeId).populate('order');
    if (!dispute) throw new Error('Dispute not found');

    if (dispute.status !== 'pending' && dispute.status !== 'under_review') {
      throw new Error('Dispute can only be resolved if pending or under review');
    }

    dispute.status = status;
    dispute.resolution = resolution;
    dispute.resolvedBy = adminId;
    dispute.resolvedAt = new Date();

    // Update order status based on resolution
    if (status === 'resolved_freelancer') {
      dispute.order.status = 'completed';
      dispute.order.completedAt = new Date();
      // Release payment to freelancer
      await Payment.findOneAndUpdate(
        { order: dispute.order._id, status: 'held_in_escrow' },
        { status: 'released', releasedAt: new Date() }
      );
    } else if (status === 'resolved_client') {
      dispute.order.status = 'cancelled';
      // Refund to client
      await Payment.findOneAndUpdate(
        { order: dispute.order._id, status: 'held_in_escrow' },
        { status: 'refunded', refundedAt: new Date() }
      );
    }

    await dispute.order.save();
    await dispute.save();

    await logActivity(
      adminId,
      'admin_resolve_dispute',
      'Dispute',
      disputeId,
      `Admin resolved dispute: ${status}. ${resolution}`,
      '0.0.0.0',
      true
    );

    return { success: true, dispute };
  } catch (error) {
    throw new Error(`Failed to resolve dispute: ${error.message}`);
  }
};

/**
 * Get all jobs with filtering (admin view)
 * @param {Number} page - Page number
 * @param {Number} limit - Items per page
 * @param {Object} filters - Filter options
 * @returns {Object} Jobs and pagination info
 */
exports.getAllJobs = async (page = 1, limit = 20, filters = {}) => {
  try {
    const query = {};

    if (filters.status) query.status = filters.status;
    if (filters.category) query.category = filters.category;

    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const jobs = await Job.find(query)
      .populate('client', 'fullName email')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Job.countDocuments(query);

    return {
      success: true,
      jobs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    throw new Error(`Failed to fetch jobs: ${error.message}`);
  }
};

/**
 * Get fraud detection alerts
 * @returns {Object} Fraud alerts
 */
exports.getFraudAlerts = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Detect suspicious patterns
    const [
      usersWithManyFailedPayments,
      usersWithRapidProposals,
      usersWithSelfReviews,
    ] = await Promise.all([
      // Users with many failed payment attempts
      User.aggregate([
        { $match: { 'paymentAttempts.failed': { $gte: 5 } } },
        { $limit: 20 },
        { $project: { fullName: 1, email: 1, paymentAttempts: 1, _id: 0 } },
      ]),
      // Users submitting proposals too rapidly
      Proposal.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$freelancer', count: { $sum: 1 } } },
        { $match: { count: { $gte: 50 } } },
        { $limit: 20 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            'user.fullName': 1,
            'user.email': 1,
            count: 1,
            _id: 0,
          },
        },
      ]),
      // Users with potential self-reviews (same IP pattern)
      Review.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$reviewerIp', count: { $sum: 1 }, reviewers: { $addToSet: '$reviewer' } } },
        { $match: { count: { $gte: 3 } } },
        { $limit: 20 },
        {
          $lookup: {
            from: 'users',
            localField: 'reviewers',
            foreignField: '_id',
            as: 'users',
          },
        },
      ]),
    ]);

    const alerts = [];

    // Process payment fraud alerts
    usersWithManyFailedPayments.forEach(user => {
      alerts.push({
        id: `payment-${user._id}`,
        user: user.fullName,
        email: user.email,
        type: 'Payment Fraud',
        reason: `${user.paymentAttempts?.failed || 0} failed payment attempts detected`,
        severity: 'high',
        confidence: 85,
        flaggedAt: new Date(),
      });
    });

    // Process bid manipulation alerts
    usersWithRapidProposals.forEach(item => {
      alerts.push({
        id: `proposal-${item.user._id}`,
        user: item.user.fullName,
        email: item.user.email,
        type: 'Bid Manipulation',
        reason: `Submitted ${item.count} proposals in 30 days (suspicious rate)`,
        severity: 'high',
        confidence: 90,
        flaggedAt: new Date(),
      });
    });

    // Process fake review alerts
    usersWithSelfReviews.forEach(item => {
      const users = item.users || [];
      if (users.length > 1) {
        alerts.push({
          id: `review-${item._id}`,
          user: 'Multiple users',
          email: 'N/A',
          type: 'Fake Reviews',
          reason: `${item.count} reviews from same IP address`,
          severity: 'high',
          confidence: 78,
          flaggedAt: new Date(),
        });
      }
    });

    return {
      success: true,
      alerts,
      stats: {
        total: alerts.length,
        highSeverity: alerts.filter(a => a.severity === 'high').length,
        mediumSeverity: alerts.filter(a => a.severity === 'medium').length,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch fraud alerts: ${error.message}`);
  }
};

/**
 * Suspend user for fraud
 * @param {ObjectId} userId - User ID to suspend
 * @param {String} reason - Fraud reason
 * @param {ObjectId} adminId - Admin performing action
 * @param {String} ip - Admin IP
 * @returns {Object} Result
 */
exports.suspendUserForFraud = async (userId, reason, adminId, ip) => {
  try {
    return await this.suspendUser(userId, `Fraud: ${reason}`, adminId, ip);
  } catch (error) {
    throw new Error(`Failed to suspend user for fraud: ${error.message}`);
  }
};

/**
 * Get AI ranking algorithm weights
 * @returns {Object} Current weights
 */
exports.getAIRankingWeights = async () => {
  try {
    const { AIRankingConfig } = require('../models/index');
    
    let config = await AIRankingConfig.findOne();
    
    // If no config exists, create with defaults
    if (!config) {
      config = await AIRankingConfig.create({
        aiScore: 40,
        rating: 30,
        completion: 20,
        response: 10
      });
    }
    
    return { 
      success: true, 
      weights: {
        aiScore: config.aiScore,
        rating: config.rating,
        completion: config.completion,
        response: config.response,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy
      }
    };
  } catch (error) {
    throw new Error(`Failed to get AI weights: ${error.message}`);
  }
};

/**
 * Update AI ranking algorithm weights
 * @param {Object} weights - New weights
 * @param {ObjectId} adminId - Admin performing action
 * @param {String} ip - Admin IP
 * @returns {Object} Result
 */
exports.updateAIRankingWeights = async (weights, adminId, ip) => {
  try {
    const { AIRankingConfig } = require('../models/index');
    
    // Check if config exists
    let config = await AIRankingConfig.findOne();
    
    if (!config) {
      config = new AIRankingConfig(weights);
    } else {
      Object.assign(config, weights);
    }
    
    config.updatedBy = adminId;
    config.updatedAt = new Date();
    await config.save();
    
    await logActivity(
      adminId,
      'admin_update_ai_weights',
      'AIRankingConfig',
      config._id,
      `AI ranking weights updated: AI=${weights.aiScore}%, Rating=${weights.rating}%, Completion=${weights.completion}%, Response=${weights.response}%`,
      ip,
      true
    );
    
    return { 
      success: true, 
      weights: {
        aiScore: config.aiScore,
        rating: config.rating,
        completion: config.completion,
        response: config.response,
        updatedAt: config.updatedAt
      }
    };
  } catch (error) {
    throw new Error(`Failed to update AI weights: ${error.message}`);
  }
};

/**
 * Delete/remove a job from platform
 * @param {ObjectId} jobId - Job ID to delete
 * @param {String} reason - Deletion reason
 * @param {ObjectId} adminId - Admin performing action
 * @param {String} ip - Admin IP
 * @returns {Object} Result
 */
exports.deleteJob = async (jobId, reason, adminId, ip) => {
  try {
    const { Proposal } = require('../models/index');
    
    const job = await Job.findById(jobId);
    if (!job) throw new Error('Job not found');
    
    // Soft delete the job
    job.isDeleted = true;
    job.deletedAt = new Date();
    job.deletedBy = adminId;
    job.deletionReason = reason;
    await job.save();
    
    // Update related proposals
    await Proposal.updateMany(
      { job: jobId },
      { jobDeletedAt: new Date() }
    );
    
    await logActivity(
      adminId,
      'admin_delete_job',
      'Job',
      jobId,
      `Job removed: "${job.title}" (${job.category}). Reason: ${reason}`,
      ip,
      true
    );
    
    return { 
      success: true, 
      message: 'Job removed successfully',
      jobId: job._id,
      jobTitle: job.title
    };
  } catch (error) {
    throw new Error(`Failed to delete job: ${error.message}`);
  }
};
