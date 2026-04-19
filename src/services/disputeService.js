
const mongoose = require('mongoose');
const { Dispute, Order, Payment, User } = require('../models/index');
const { logActivity, sendNotification } = require('../utils/helpers');

/**
 * CREATE DISPUTE
 */
exports.createDispute = async (orderId, userId, disputeData, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId)
      .populate('client')
      .populate('freelancer')
      .session(session);

    if (!order) {
      await session.abortTransaction();
      throw new Error('Order not found');
    }

    const isClient = order.client._id.toString() === userId.toString();
    const isFreelancer = order.freelancer._id.toString() === userId.toString();

    if (!isClient && !isFreelancer) {
      await session.abortTransaction();
      throw new Error('Only order participants can create disputes');
    }

    // Check if dispute already exists
    const existing = await Dispute.findOne({
      order: orderId,
      status: { $in: ['pending', 'under_review'] },
    }).session(session);

    if (existing) {
      await session.abortTransaction();
      throw new Error('Dispute already exists for this order');
    }

    // Create dispute
    const dispute = await Dispute.create(
      [
        {
          order: orderId,
          raisedBy: userId,
          against: isClient ? order.freelancer._id : order.client._id,
          reason: disputeData.reason,
          description: disputeData.description,
          evidence: disputeData.evidence || [],
          status: 'pending',
        },
      ],
      { session }
    );

    // Update order status
    order.status = 'disputed';
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Notify both parties (outside transaction)
    try {
      await sendNotification(isClient ? order.freelancer._id : order.client._id, {
        type: 'dispute_opened',
        title: '⚠️ Dispute Opened',
        message: `A dispute was opened for order #${orderId.toString().slice(-6)}. Reason: ${disputeData.reason}`,
        link: `/disputes/${dispute[0]._id}`,
      });
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
      // Don't fail the entire operation if notification fails
    }

    // Notify admin (outside transaction)
    try {
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await sendNotification(admin._id, {
          type: 'dispute_opened',
          title: '🚨 New Dispute - Action Required',
          message: `Dispute opened for order #${orderId.toString().slice(-6)}`,
          link: `/admin/disputes/${dispute[0]._id}`,
        });
      }
    } catch (notifErr) {
      console.error('Admin notification error:', notifErr);
      // Don't fail the entire operation if notification fails
    }

    await logActivity(
      userId,
      'create_dispute',
      'Dispute',
      dispute[0]._id,
      `Created dispute: ${disputeData.reason}`,
      ip
    );

    return {
      success: true,
      dispute: dispute[0],
      message: 'Dispute created, awaiting admin review',
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * ASSIGN DISPUTE TO ADMIN
 */
exports.assignDispute = async (disputeId, adminId, ip) => {
  const dispute = await Dispute.findById(disputeId);

  if (!dispute) throw new Error('Dispute not found');

  dispute.assignedAdmin = adminId;
  dispute.status = 'under_review';
  await dispute.save();

  await logActivity(adminId, 'assign_dispute', 'Dispute', disputeId, 'Assigned to self', ip, true);

  return { success: true, dispute, message: 'Dispute assigned' };
};

/**
 * RESOLVE DISPUTE
 */
exports.resolveDispute = async (disputeId, adminId, resolutionData, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const dispute = await Dispute.findById(disputeId)
      .populate('order')
      .populate('raisedBy')
      .populate('against')
      .session(session);

    if (!dispute) {
      await session.abortTransaction();
      throw new Error('Dispute not found');
    }

    if (!['pending', 'under_review'].includes(dispute.status)) {
      await session.abortTransaction();
      throw new Error('Dispute cannot be resolved from current status');
    }

    const { resolutionType, refundAmount, resolution } = resolutionData;

    // Update dispute
    dispute.status = resolutionType.includes('client') ? 'resolved_client' : 'resolved_freelancer';
    dispute.resolutionType = resolutionType;
    dispute.refundAmount = refundAmount || 0;
    dispute.resolution = resolution;
    dispute.resolvedAt = new Date();
    dispute.messages.push({
      sender: adminId,
      content: `Resolution: ${resolution}`,
      isAdmin: true,
      sentAt: new Date(),
    });
    await dispute.save({ session });

    const order = dispute.order;

    // Handle refunds if needed
    if (refundAmount > 0) {
      // Create refund payment
      const refund = await Payment.create(
        [
          {
            order: order._id,
            payer: order.freelancer,
            payee: order.client,
            grossAmount: refundAmount,
            platformFee: 0, // Refunds don't incur additional fees
            netAmount: refundAmount,
            status: 'released',
            type: 'refund',
            refundedAt: new Date(),
          },
        ],
        { session }
      );

      // Revert freelancer earnings if needed
      if (order.status === 'completed' && refundAmount > 0) {
        await User.findByIdAndUpdate(
          order.freelancer,
          {
            $inc: {
              walletBalance: -refundAmount,
              totalEarned: -refundAmount,
            },
          },
          { session }
        );
      }

      // Refund client
      const client = await User.findById(order.client).session(session);
      if (client) {
        client.totalSpent -= refundAmount;
        await client.save({ session });
      }
    }

    // Update order status
    order.status = 'resolved';
    await order.save({ session });

    await session.commitTransaction();

    // Notify both parties
    await sendNotification(dispute.raisedBy._id, {
      type: 'dispute_resolved',
      title: '✅ Dispute Resolved',
      message: `Your dispute has been resolved. Resolution: ${resolution}${refundAmount ? ` Refund: $${refundAmount}` : ''}`,
      link: `/disputes/${dispute._id}`,
    });

    await sendNotification(dispute.against, {
      type: 'dispute_resolved',
      title: '✅ Dispute Resolved',
      message: `A dispute against you has been resolved. Check details for outcome.`,
      link: `/disputes/${dispute._id}`,
    });

    await logActivity(adminId, 'resolve_dispute', 'Dispute', disputeId, `Resolved: ${resolution}`, ip, true);

    return {
      success: true,
      dispute,
      message: 'Dispute resolved successfully',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * GET DISPUTES
 */
exports.getDisputes = async (userId, page = 1, limit = 10, status = null) => {
  const skip = (page - 1) * limit;
  const query = {
    $or: [{ raisedBy: userId }, { against: userId }],
  };

  if (status) query.status = status;

  const [disputes, total] = await Promise.all([
    Dispute.find(query)
      .populate('order', 'title status')
      .populate('raisedBy', 'fullName profileImage')
      .populate('against', 'fullName profileImage')
      .populate('assignedAdmin', 'fullName')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Dispute.countDocuments(query),
  ]);

  return {
    success: true,
    disputes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * ADD MESSAGE TO DISPUTE
 */
exports.addDisputeMessage = async (disputeId, userId, content, ip, isAdmin = false) => {
  const dispute = await Dispute.findById(disputeId);

  if (!dispute) throw new Error('Dispute not found');

  dispute.messages.push({
    sender: userId,
    content,
    isAdmin,
    sentAt: new Date(),
  });
  await dispute.save();

  await logActivity(userId, 'message_dispute', 'Dispute', disputeId, 'Added message', ip, isAdmin);

  return { success: true, dispute, message: 'Message added' };
};

/**
 * GET ADMIN DISPUTES
 */
exports.getAdminDisputes = async (page = 1, limit = 15, status = null, sort = '-createdAt') => {
  const skip = (page - 1) * limit;
  const query = {};

  if (status) query.status = status;

  const [disputes, total] = await Promise.all([
    Dispute.find(query)
      .populate('order', 'title grossAmount status')
      .populate('raisedBy', 'fullName email')
      .populate('against', 'fullName email')
      .populate('assignedAdmin', 'fullName email')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Dispute.countDocuments(query),
  ]);

  return {
    success: true,
    disputes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
