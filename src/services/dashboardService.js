/**
 * dashboardService.js
 * User dashboard analytics and statistics
 * Freelancer dashboard, client dashboard, performance metrics
 */

const { Job, Order, Payment, Review, Proposal, User } = require('../models/index');

/**
 * Get freelancer dashboard stats
 * @param {ObjectId} freelancerId - Freelancer user ID
 * @returns {Object} Freelancer dashboard data
 */
exports.getFreelancerDashboard = async (freelancerId) => {
  try {
    const [
      pendingProposals,
      activeOrders,
      completedOrders,
      totalEarnings,
      averageRating,
      totalReviews,
      recentOrders,
      jobsMatched,
    ] = await Promise.all([
      Proposal.countDocuments({ freelancer: freelancerId, status: 'pending' }),
      Order.countDocuments({ freelancer: freelancerId, status: 'in_progress' }),
      Order.countDocuments({ freelancer: freelancerId, status: 'completed' }),
      Payment.aggregate([
        { $match: { payee: freelancerId, status: 'released' } },
        { $group: { _id: null, total: { $sum: '$netAmount' } } },
      ]),
      User.findById(freelancerId).select('averageRating'),
      Review.countDocuments({ reviewee: freelancerId }),
      Order.find({ freelancer: freelancerId })
        .sort('-updatedAt')
        .limit(5)
        .select('_id title status grossAmount completedAt')
        .populate('client', 'fullName'),
      Job.countDocuments({ skills: { $in: await User.findById(freelancerId).select('skills') } }),
    ]);

    const earnings = totalEarnings[0]?.total || 0;
    const user = averageRating;

    return {
      success: true,
      dashboard: {
        stats: {
          pendingProposals,
          activeOrders,
          completedOrders,
          totalEarnings: earnings,
          averageRating: user?.averageRating || 0,
          totalReviews,
          responseRate: '100%', // Can be calculated based on proposal acceptance
          jobsMatchedToSkills: jobsMatched,
        },
        recentOrders,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch freelancer dashboard: ${error.message}`);
  }
};

/**
 * Get client dashboard stats
 * @param {ObjectId} clientId - Client user ID
 * @returns {Object} Client dashboard data
 */
exports.getClientDashboard = async (clientId) => {
  try {
    const [
      jobsPosted,
      jobsOpen,
      jobsClosed,
      totalSpent,
      activeOrders,
      completedOrders,
      pendingProposals,
      recentActivity,
    ] = await Promise.all([
      Job.countDocuments({ client: clientId }),
      Job.countDocuments({ client: clientId, status: 'open' }),
      Job.countDocuments({ client: clientId, status: 'closed' }),
      Order.aggregate([
        { $match: { client: clientId } },
        { $group: { _id: null, total: { $sum: '$grossAmount' } } },
      ]),
      Order.countDocuments({ client: clientId, status: 'in_progress' }),
      Order.countDocuments({ client: clientId, status: 'completed' }),
      Proposal.countDocuments({ job: { $in: await Job.find({ client: clientId }).select('_id') } }),
      Order.find({ client: clientId })
        .sort('-updatedAt')
        .limit(5)
        .select('_id title status grossAmount updatedAt')
        .populate('freelancer', 'fullName'),
    ]);

    const spent = totalSpent[0]?.total || 0;

    return {
      success: true,
      dashboard: {
        stats: {
          jobsPosted,
          jobsOpen,
          jobsClosed,
          totalSpent: spent,
          activeOrders,
          completedOrders,
          pendingProposalsToReview: pendingProposals,
        },
        recentActivity,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch client dashboard: ${error.message}`);
  }
};

/**
 * Get freelancer performance metrics
 * @param {ObjectId} freelancerId - Freelancer user ID
 * @returns {Object} Performance metrics
 */
exports.getFreelancerPerformance = async (freelancerId) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Last 30 days
    const completedLast30 = await Order.countDocuments({
      freelancer: freelancerId,
      status: 'completed',
      completedAt: { $gte: thirtyDaysAgo },
    });

    const earnedLast30 = await Payment.aggregate([
      {
        $match: {
          payee: freelancerId,
          status: 'released',
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$netAmount' } } },
    ]);

    // Completion time
    const completionTimes = await Order.aggregate([
      { $match: { freelancer: freelancerId, status: 'completed', completedAt: { $gte: ninetyDaysAgo } } },
      {
        $group: {
          _id: null,
          avgTime: {
            $avg: { $subtract: ['$completedAt', '$createdAt'] },
          },
          minTime: {
            $min: { $subtract: ['$completedAt', '$createdAt'] },
          },
          maxTime: {
            $max: { $subtract: ['$completedAt', '$createdAt'] },
          },
        },
      },
    ]);

    const times = completionTimes[0] || { avgTime: 0, minTime: 0, maxTime: 0 };

    // Recent reviews
    const recentReviews = await Review.find({ reviewee: freelancerId })
      .sort('-createdAt')
      .limit(5)
      .select('rating review reviewer createdAt');

    return {
      success: true,
      performance: {
        last30Days: {
          ordersCompleted: completedLast30,
          totalEarned: earnedLast30[0]?.total || 0,
        },
        completionMetrics: {
          avgCompletionTime: Math.round(times.avgTime / (1000 * 60 * 60 * 24)) + ' days',
          minTime: Math.round(times.minTime / (1000 * 60 * 60 * 24)) + ' days',
          maxTime: Math.round(times.maxTime / (1000 * 60 * 60 * 24)) + ' days',
        },
        recentReviews,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch performance metrics: ${error.message}`);
  }
};

/**
 * Get earnings breakdown
 * @param {ObjectId} freelancerId - Freelancer user ID
 * @param {String} period - 'week', 'month', 'year', or null (all time)
 * @returns {Object} Earnings breakdown
 */
exports.getEarningsBreakdown = async (freelancerId, period = 'month') => {
  try {
    let dateFilter = {};

    if (period === 'week') {
      dateFilter = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    } else if (period === 'month') {
      dateFilter = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    } else if (period === 'year') {
      dateFilter = { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
    }

    const earnings = await Payment.aggregate([
      { $match: { payee: freelancerId, status: 'released' } },
      ...(Object.keys(dateFilter).length > 0 ? [{ $match: { createdAt: dateFilter } }] : []),
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$netAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totalEarnings = earnings.reduce((sum, day) => sum + day.total, 0);

    return {
      success: true,
      earnings: {
        period,
        byDay: earnings,
        total: totalEarnings,
        avgPerDay: earnings.length > 0 ? totalEarnings / earnings.length : 0,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch earnings breakdown: ${error.message}`);
  }
};

/**
 * Get user recommendations (jobs for freelancer, freelancers for client)
 * @param {ObjectId} userId - User ID
 * @param {String} userRole - 'freelancer' or 'client'
 * @returns {Object} Recommendations
 */
exports.getRecommendations = async (userId, userRole) => {
  try {
    if (userRole === 'freelancer') {
      // Get recommended jobs based on freelancer skills
      const user = await User.findById(userId).select('skills experienceLevel');

      const recommendedJobs = await Job.find({
        $or: [
          { skills: { $in: user.skills } },
          { experienceLevel: user.experienceLevel },
        ],
        status: 'open',
      })
        .sort('-createdAt')
        .limit(10)
        .select('_id title category budgetMin budgetMax skills');

      return { success: true, recommendations: recommendedJobs };
    } else if (userRole === 'client') {
      // Get recommended freelancers based on jobs posted
      const clientJobs = await Job.find({ client: userId }).select('skills');

      if (clientJobs.length === 0) {
        return { success: true, recommendations: [] };
      }

      const allSkills = clientJobs.flatMap(j => j.skills);

      const recommendedFreelancers = await User.find({
        skills: { $in: allSkills },
        role: 'freelancer',
      })
        .sort('-averageRating')
        .limit(10)
        .select('_id fullName averageRating totalReviews skills');

      return { success: true, recommendations: recommendedFreelancers };
    }

    throw new Error('Invalid user role');
  } catch (error) {
    throw new Error(`Failed to fetch recommendations: ${error.message}`);
  }
};
