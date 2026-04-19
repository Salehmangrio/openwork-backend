const mongoose = require('mongoose');
const { Job, User, Notification, Order } = require('../models/index');
const { logActivity, sendNotification } = require('../utils/helpers');

/**
 * CREATE JOB FLOW
 * 
 * Cascade Updates:
 * 1. Create job document
 * 2. Update client stats (totalJobs++)
 * 3. Notify matching freelancers (based on skills)
 * 4. Log activity
 */
exports.createJob = async (jobData, clientId, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // === VALIDATE CLIENT ===
    const client = await User.findById(clientId).session(session);

    if (!client) {
      throw new Error('Client not found');
    }

    if (!client.canActAsClient && client.role !== 'client' && client.role !== 'admin') {
      throw new Error('User not authorized to post jobs');
    }

    // === CHECK WALLET BALANCE ===
    // Hold budgetMax in escrow when creating a job
    const escrowAmount = jobData.budgetMax;
    if (client.walletBalance < escrowAmount) {
      throw new Error(`Insufficient wallet balance. Required: $${escrowAmount}, Available: $${client.walletBalance}`);
    }

    // === VALIDATE JOB DATA ===
    if (!jobData.title || jobData.title.trim().length < 10) {
      throw new Error('Job title must be at least 10 characters');
    }

    if (!jobData.description || jobData.description.trim().length < 50) {
      throw new Error('Job description must be at least 50 characters');
    }

    if (!jobData.budgetMin || !jobData.budgetMax || jobData.budgetMin < 1) {
      throw new Error('Valid budget range required (min: $1)');
    }

    if (jobData.budgetMin > jobData.budgetMax) {
      throw new Error('Budget minimum cannot exceed maximum');
    }

    if (!jobData.category) {
      throw new Error('Job category is required');
    }

    if (!jobData.skills || jobData.skills.length === 0) {
      throw new Error('At least one skill is required');
    }

    // === CREATE JOB ===
    const job = await Job.create(
      [
        {
          client: clientId,
          title: jobData.title.trim(),
          description: jobData.description.trim(),
          category: jobData.category,
          skills: jobData.skills || [],
          budgetType: jobData.budgetType || 'fixed',
          budgetMin: jobData.budgetMin,
          budgetMax: jobData.budgetMax,
          duration: jobData.duration || '1 month',
          experienceLevel: jobData.experienceLevel || 'any',
          visibility: jobData.visibility || 'public',
          isUrgent: jobData.isUrgent || false,
          attachments: jobData.attachments || [],
          deadline: jobData.deadline ? new Date(jobData.deadline) : null,
          status: 'open',
          proposalCount: 0,
          viewCount: 0,
        },
      ],
      { session }
    );

    // === UPDATE CLIENT STATS ===
    await User.findByIdAndUpdate(
      clientId,
      {
        $inc: {
          totalJobs: 1,
          walletBalance: -escrowAmount,
          pendingEarnings: escrowAmount,
        },
      },
      { session }
    );

    await session.commitTransaction();

    // === POST-TRANSACTION OPERATIONS ===
    // Notify matching freelancers (do this outside transaction)
    await notifyMatchingFreelancers(job[0], clientId);

    // === LOG ACTIVITY ===
    await logActivity(
      clientId,
      'create_job',
      'Job',
      job[0]._id,
      `Posted job: "${job[0].title}". Budget: $${job[0].budgetMin}-$${job[0].budgetMax}. Skills: ${job[0].skills.join(', ')}`,
      ip
    );

    return {
      success: true,
      job: job[0],
      message: 'Job posted successfully!',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * NOTIFY MATCHING FREELANCERS
 * (Helper function)
 */
const notifyMatchingFreelancers = async (job, clientId) => {
  try {
    // Find freelancers with matching skills
    const matchingFreelancers = await User.find({
      $or: [{ role: 'freelancer' }, { canActAsFreelancer: true }],
      isActive: true,
      isBanned: false,
      skills: { $in: job.skills },
      _id: { $ne: clientId },
    })
      .limit(100)
      .select('_id fullName');

    // Notify each matching freelancer
    for (const freelancer of matchingFreelancers) {
      await sendNotification(freelancer._id, {
        type: 'job_match',
        title: '🎯 New Job Match!',
        message: `New ${job.category} job matching your skills: "${job.title}" - Budget: $${job.budgetMin}-$${job.budgetMax}`,
        link: `/jobs/${job._id}`,
        metadata: {
          jobId: job._id,
          budget: `$${job.budgetMin}-$${job.budgetMax}`,
          skills: job.skills,
        },
      });
    }
  } catch (err) {
    console.error('Error notifying matching freelancers:', err);
    // Don't throw - partial notification failure shouldn't fail entire job creation
  }
};

/**
 * GET JOB LISTINGS
 */
exports.getJobs = async (
  page = 1,
  limit = 12,
  filters = {}
) => {
  const skip = (page - 1) * limit;
  const query = { status: 'open', isFlagged: false };

  // Apply filters
  if (filters.category) query.category = filters.category;
  if (filters.budgetMin) query.budgetMin = { $gte: filters.budgetMin };
  if (filters.budgetMax) query.budgetMax = { $lte: filters.budgetMax };
  if (filters.experienceLevel) query.experienceLevel = filters.experienceLevel;
  if (filters.skills && filters.skills.length > 0) {
    query.skills = { $in: filters.skills };
  }
  if (filters.isUrgent) query.isUrgent = true;
  if (filters.search) {
    query.$text = { $search: filters.search };
  }

  const [jobs, total] = await Promise.all([
    Job.find(query)
      .populate('client', 'fullName profileImage companyName')
      .sort(filters.sort === 'newest' ? '-createdAt' : '-isUrgent')
      .skip(skip)
      .limit(limit),
    Job.countDocuments(query),
  ]);

  return {
    success: true,
    jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * GET JOB DETAILS
 */
exports.getJobDetails = async (jobId) => {
  const job = await Job.findById(jobId)
    .populate('client', 'fullName profileImage companyName totalSpent averageRating totalReviews')
    .populate('hiredFreelancer', 'fullName profileImage title aiSkillScore')
    .populate('proposals', '-attachments', null, { limit: 5 });

  if (!job) throw new Error('Job not found');

  // Increment view count
  job.viewCount = (job.viewCount || 0) + 1;
  await job.save({ validateBeforeSave: false });

  return {
    success: true,
    job,
  };
};

/**
 * UPDATE JOB
 */
exports.updateJob = async (jobId, jobData, userId, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const job = await Job.findById(jobId).session(session);

    if (!job) {
      await session.abortTransaction();
      throw new Error('Job not found');
    }

    // Verify authorization
    if (job.client.toString() !== userId.toString()) {
      await session.abortTransaction();
      throw new Error('Not authorized - only job client can edit');
    }

    // Cannot edit in-progress jobs
    if (!['open', 'paused'].includes(job.status)) {
      await session.abortTransaction();
      throw new Error(`Cannot edit job with status: ${job.status}`);
    }

    // Update allowed fields only
    const allowedFields = ['title', 'description', 'budgetMin', 'budgetMax', 'skills', 'deadline', 'isUrgent'];
    for (const field of allowedFields) {
      if (jobData[field] !== undefined) {
        job[field] = jobData[field];
      }
    }

    await job.save({ session, validateBeforeSave: false });
    await session.commitTransaction();

    await logActivity(userId, 'update_job', 'Job', jobId, `Updated job: "${job.title}"`, ip);

    return {
      success: true,
      job,
      message: 'Job updated successfully',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * PAUSE JOB
 */
exports.pauseJob = async (jobId, userId, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const job = await Job.findById(jobId).session(session);

    if (!job) {
      await session.abortTransaction();
      throw new Error('Job not found');
    }

    if (job.client.toString() !== userId.toString()) {
      await session.abortTransaction();
      throw new Error('Not authorized');
    }

    if (job.status !== 'open') {
      await session.abortTransaction();
      throw new Error('Only open jobs can be paused');
    }

    job.status = 'paused';
    await job.save({ session });
    await session.commitTransaction();

    await logActivity(userId, 'pause_job', 'Job', jobId, `Paused job: "${job.title}"`, ip);

    return { success: true, job, message: 'Job paused' };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * CLOSE JOB
 */
exports.closeJob = async (jobId, userId, reason, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const job = await Job.findById(jobId).session(session);

    if (!job) {
      await session.abortTransaction();
      throw new Error('Job not found');
    }

    if (job.client.toString() !== userId.toString()) {
      await session.abortTransaction();
      throw new Error('Not authorized');
    }

    job.status = 'completed';
    job.completedAt = new Date();
    await job.save({ session });

    // Refund escrow amount to client wallet if job is closed without hiring
    const escrowRefund = job.hiredFreelancer ? 0 : job.budgetMax;
    if (escrowRefund > 0) {
      await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            walletBalance: escrowRefund,
            pendingEarnings: -escrowRefund,
          },
        },
        { session }
      );
    }

    await session.commitTransaction();

    await logActivity(userId, 'close_job', 'Job', jobId, `Closed job: "${job.title}". Reason: ${reason}. Escrow refunded: $${escrowRefund}`, ip);

    // Notify hired freelancer
    if (job.hiredFreelancer) {
      await sendNotification(job.hiredFreelancer, {
        type: 'job_completed',
        title: '✅ Job Closed',
        message: `Job "${job.title}" has been marked as completed.`,
        link: `/jobs/${jobId}`,
      });
    }

    return {
      success: true,
      job,
      message: 'Job closed successfully',
      escrowRefund,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * DELETE JOB
 */
exports.deleteJob = async (jobId, userId, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const job = await Job.findById(jobId).session(session);

    if (!job) {
      await session.abortTransaction();
      throw new Error('Job not found');
    }

    if (job.client.toString() !== userId.toString()) {
      await session.abortTransaction();
      throw new Error('Not authorized');
    }

    if (!['open', 'paused'].includes(job.status)) {
      await session.abortTransaction();
      throw new Error('Cannot delete job with active orders');
    }

    await Job.findByIdAndDelete(jobId, { session });

    // Refund escrow amount to client wallet
    const escrowRefund = job.budgetMax;
    await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          totalJobs: -1,
          walletBalance: escrowRefund,
          pendingEarnings: -escrowRefund,
        },
      },
      { session }
    );

    await session.commitTransaction();

    await logActivity(userId, 'delete_job', 'Job', jobId, `Deleted job. Escrow refunded: $${escrowRefund}`, ip);

    return {
      success: true,
      message: 'Job deleted successfully',
      escrowRefund,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * GET CLIENT'S JOBS
 */
exports.getClientJobs = async (clientId, page = 1, limit = 12, status = null) => {
  const skip = (page - 1) * limit;
  const query = { client: clientId };

  if (status) query.status = status;

  const [jobs, total] = await Promise.all([
    Job.find(query)
      .populate('hiredFreelancer', 'fullName profileImage')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Job.countDocuments(query),
  ]);

  return {
    success: true,
    jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
