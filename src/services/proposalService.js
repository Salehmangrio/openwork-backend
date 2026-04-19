const mongoose = require('mongoose');
const { Proposal, Order, Payment, Job, User, Notification } = require('../models/index');
const { logActivity, sendNotification } = require('../utils/helpers');

/**
 * ACCEPT PROPOSAL FLOW
 * 
 * Cascade Updates:
 * 1. Update proposal status to "accepted"
 * 2. Reject all other proposals for this job
 * 3. Update job status to "in_progress"
 * 4. Update job.hiredFreelancer
 * 5. Create Order
 * 6. Create Payment (escrow)
 * 7. Update freelancer stats (totalJobs++)
 * 8. Update client stats (totalSpent += bidAmount)
 * 9. Send notifications
 * 10. Log activity
 */
exports.acceptProposal = async (proposalId, userId, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // === FETCH & VALIDATE ===
    const proposal = await Proposal.findById(proposalId)
      .populate('job')
      .populate('freelancer')
      .session(session);

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (!proposal.job) {
      throw new Error('Job not found');
    }

    // Verify client authorization
    if (proposal.job.client.toString() !== userId.toString()) {
      throw new Error('Not authorized - only job client can accept proposals');
    }

    // Check if already accepted
    if (proposal.status === 'accepted') {
      throw new Error('This proposal is already accepted');
    }

    // Check if another proposal is already accepted
    const alreadyAccepted = await Proposal.findOne({
      job: proposal.job._id,
      status: 'accepted',
      _id: { $ne: proposalId },
    }).session(session);

    if (alreadyAccepted) {
      throw new Error('Another proposal has already been accepted for this job');
    }

    // === CHECK WALLET BALANCE FOR BID AMOUNT ===
    // Verify bid amount doesn't exceed job budget
    const job = proposal.job;
    const client = await User.findById(job.client).session(session);
    
    if (proposal.bidAmount > job.budgetMax) {
      const error = new Error(`Bid amount ($${proposal.bidAmount}) exceeds job budget ($${job.budgetMax})`);
      error.code = 'BUDGET_MISMATCH';
      error.statusCode = 400;
      error.bidAmount = proposal.bidAmount;
      error.jobBudget = job.budgetMax;
      throw error;
    }

    // Check if client has sufficient balance - if not, provide specific error
    if (client.walletBalance < proposal.bidAmount) {
      const shortfall = proposal.bidAmount - client.walletBalance;
      const error = new Error(`Insufficient wallet balance. Need $${proposal.bidAmount}, Have $${client.walletBalance}, Shortfall: $${shortfall}`);
      error.code = 'INSUFFICIENT_BALANCE';
      error.statusCode = 400;
      error.required = proposal.bidAmount;
      error.available = client.walletBalance;
      error.shortfall = shortfall;
      throw error;
    }

    // Calculate escrow difference to refund to client
    const escrowRefund = job.budgetMax - proposal.bidAmount;

    // === UPDATE PROPOSAL ===
    proposal.status = 'accepted';
    await proposal.save({ session, validateBeforeSave: false });

    // === REJECT OTHER PROPOSALS ===
    await Proposal.updateMany(
      { job: proposal.job._id, _id: { $ne: proposalId } },
      { status: 'rejected' },
      { session }
    );

    // === UPDATE JOB ===
    job.status = 'in_progress';
    job.hiredFreelancer = proposal.freelancer._id;
    job.hiredAt = new Date();
    await job.save({ session, validateBeforeSave: false });

    // === CREATE ORDER ===
    // FEE STRUCTURE: Client pays 0%, freelancer will pay 5% when order completes
    const order = await Order.create(
      [
        {
          job: job._id,
          proposal: proposalId,
          client: job.client,
          freelancer: proposal.freelancer._id,
          title: job.title,
          description: job.description,
          grossAmount: proposal.bidAmount,
          platformFee: 0, // Client pays 0% at order creation
          netAmount: proposal.bidAmount, // Full amount (no fee deducted yet)
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default: 7 days
          status: 'in_progress', // Skip payment step for now
          escrowReleased: false,
        },
      ],
      { session }
    );

    // === CREATE PAYMENT (ESCROW) ===
    const payment = await Payment.create(
      [
        {
          order: order[0]._id,
          payer: job.client,
          payee: proposal.freelancer._id,
          grossAmount: proposal.bidAmount,
          platformFee: 0, // No fee charged to client
          netAmount: proposal.bidAmount, // Full amount held in escrow
          status: 'held_in_escrow',
          type: 'order_payment',
          method: 'stripe',
        },
      ],
      { session }
    );

    // === UPDATE FREELANCER STATS ===
    // Add to pendingEarnings (escrow) when order starts
    await User.findByIdAndUpdate(
      proposal.freelancer._id,
      {
        $inc: {
          totalJobs: 1,
          pendingEarnings: proposal.bidAmount,
        },
      },
      { session, new: true }
    );

    // === UPDATE CLIENT STATS ===
    // Escrow: Deduct from wallet and add to budgetAllocated
    // Refund the difference between job budgetMax and bidAmount to wallet
    await User.findByIdAndUpdate(
      job.client,
      {
        $inc: {
          walletBalance: -proposal.bidAmount + escrowRefund, // Deduct bid, refund difference
          budgetAllocated: proposal.bidAmount, // Lock bid amount in escrow
        },
      },
      { session, new: true }
    );

    // === COMMIT TRANSACTION ===
    await session.commitTransaction();

    // === POST-TRANSACTION NOTIFICATIONS ===
    // Notify accepted freelancer
    await sendNotification(proposal.freelancer._id, {
      type: 'proposal_accepted',
      title: '🎉 Congratulations! Proposal Accepted!',
      message: `Your proposal for "${job.title}" has been accepted. Order #${order[0]._id.toString().slice(-6)} created.`,
      link: `/orders/${order[0]._id}`,
    });

    // Notify rejected freelancers
    const rejectedProposals = await Proposal.find({
      job: job._id,
      status: 'rejected',
      _id: { $ne: proposalId },
    }).select('freelancer');

    for (const rejProp of rejectedProposals) {
      await sendNotification(rejProp.freelancer, {
        type: 'proposal_rejected',
        title: 'Proposal Not Selected',
        message: `Another proposal was selected for "${job.title}". Keep applying to find work!`,
        link: `/jobs/${job._id}`,
      });
    }

    // Notify job client
    await sendNotification(job.client, {
      type: 'order_created',
      title: 'Order Created Successfully',
      message: `Order #${order[0]._id.toString().slice(-6)} created with ${proposal.freelancer.fullName}. Total: $${proposal.bidAmount}`,
      link: `/orders/${order[0]._id}`,
    });

    // === LOG ACTIVITY ===
    await logActivity(
      userId,
      'accept_proposal',
      'Proposal',
      proposalId,
      `Accepted proposal from ${proposal.freelancer.fullName} for "${job.title}". Bid: $${proposal.bidAmount}. Order created.`,
      ip,
      false
    );

    return {
      success: true,
      proposal,
      order: order[0],
      payment: payment[0],
      message: 'Proposal accepted successfully!',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * GET PROPOSALS WITH PAGINATION
 */
exports.getJobProposals = async (jobId, userId, page = 1, limit = 15) => {
  const job = await Job.findById(jobId);
  if (!job) throw new Error('Job not found');

  // Verify authorization
  if (job.client.toString() !== userId.toString()) {
    throw new Error('Not authorized - only job client can view proposals');
  }

  const skip = (page - 1) * limit;

  const [proposals, total] = await Promise.all([
    Proposal.find({ job: jobId })
      .populate('freelancer', 'fullName profileImage title aiSkillScore averageRating totalReviews completedJobs hourlyRate skills')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Proposal.countDocuments({ job: jobId }),
  ]);

  return {
    success: true,
    proposals,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * GET FREELANCER'S PROPOSALS
 */
exports.getMyProposals = async (userId, page = 1, limit = 15) => {
  const skip = (page - 1) * limit;

  const [proposals, total] = await Promise.all([
    Proposal.find({ freelancer: userId })
      .populate({
        path: 'job',
        select: 'title budgetMin budgetMax category client status',
        populate: {
          path: 'client',
          select: 'fullName companyName profileImage',
        },
      })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Proposal.countDocuments({ freelancer: userId }),
  ]);

  return {
    success: true,
    proposals,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * WITHDRAW PROPOSAL
 */
exports.withdrawProposal = async (proposalId, userId, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const proposal = await Proposal.findById(proposalId)
      .populate('job')
      .session(session);

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.freelancer.toString() !== userId.toString()) {
      throw new Error('Not authorized - only proposal creator can withdraw');
    }

    if (proposal.status === 'accepted') {
      throw new Error('Cannot withdraw an accepted proposal');
    }

    if (proposal.status === 'withdrawn') {
      throw new Error('Proposal is already withdrawn');
    }

    // Update proposal status
    proposal.status = 'withdrawn';
    await proposal.save({ session, validateBeforeSave: false });

    // Decrement job proposal count
    await Job.findByIdAndUpdate(
      proposal.job._id,
      { $inc: { proposalCount: -1 } },
      { session }
    );

    await session.commitTransaction();

    // Notify client
    await sendNotification(proposal.job.client, {
      type: 'proposal_withdrawn',
      title: 'Proposal Withdrawn',
      message: `A freelancer withdrew their proposal for "${proposal.job.title}"`,
      link: `/jobs/${proposal.job._id}/proposals`,
    });

    await logActivity(userId, 'withdraw_proposal', 'Proposal', proposalId, `Withdrew proposal`, ip);

    return {
      success: true,
      message: 'Proposal withdrawn successfully',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * REJECT PROPOSAL (Client rejects a single proposal)
 * - Only rejects the specified proposal
 * - Does NOT affect other proposals
 * - Notifies the freelancer
 */
exports.rejectProposal = async (proposalId, userId, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const proposal = await Proposal.findById(proposalId)
      .populate('job')
      .populate('freelancer')
      .session(session);

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (!proposal.job) {
      throw new Error('Job not found');
    }

    // Verify client authorization
    if (proposal.job.client.toString() !== userId.toString()) {
      throw new Error('Not authorized - only job client can reject proposals');
    }

    // Check if proposal is already rejected or accepted
    if (proposal.status === 'accepted') {
      throw new Error('Cannot reject an accepted proposal');
    }

    if (proposal.status === 'rejected') {
      throw new Error('Proposal is already rejected');
    }

    // Update only this proposal status to rejected
    proposal.status = 'rejected';
    await proposal.save({ session, validateBeforeSave: false });

    await session.commitTransaction();

    // Notify freelancer about rejection
    await sendNotification(proposal.freelancer._id, {
      type: 'proposal_rejected',
      title: 'Proposal Not Selected',
      message: `Your proposal for "${proposal.job.title}" was not selected. Keep applying to find work!`,
      link: `/jobs/${proposal.job._id}`,
    });

    // Log activity
    await logActivity(
      userId,
      'reject_proposal',
      'Proposal',
      proposalId,
      `Rejected proposal from ${proposal.freelancer.fullName} for "${proposal.job.title}"`,
      ip
    );

    return {
      success: true,
      message: 'Proposal rejected successfully',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
