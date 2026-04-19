const mongoose = require('mongoose');
const { Order, Payment, User, Job, Review, Notification } = require('../models/index');
const { logActivity, sendNotification } = require('../utils/helpers');

/**
 * COMPLETE ORDER FLOW
 * 
 * FEE STRUCTURE:
 * - When order is created: platformFee = 0 (client pays nothing extra)
 * - When order is completed: 5% fee is deducted from freelancer's earnings
 * 
 * Cascade Updates:
 * 1. Update order status to "completed"
 * 2. Calculate 5% platform fee on grossAmount
 * 3. Update payment status to "released" with calculated fee
 * 4. Update freelancer:
 *    - totalEarned += netAmount (after 5% fee)
 *    - totalFeesPaid += platformFee (5%)
 *    - completedJobs++
 *    - walletBalance += netAmount (after 5% fee)
 *    - pendingEarnings -= grossAmount
 * 5. Update client stats if needed
 * 6. Create notification
 * 7. Log activity
 */
exports.completeOrder = async (orderId, userId, isFreelancer = false, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // === FETCH & VALIDATE ===
    const order = await Order.findById(orderId)
      .populate('client')
      .populate('freelancer')
      .session(session);

    if (!order) {
      throw new Error('Order not found');
    }

    // Determine who is marking as complete
    const isClient = order.client._id.toString() === userId.toString();

    // Both parties or authorized users can complete
    if (!isClient && order.freelancer._id.toString() !== userId.toString()) {
      throw new Error('Not authorized to complete this order');
    }

    // Validate state
    if (order.status === 'completed') {
      throw new Error('Order is already completed');
    }

    if (!['delivered', 'in_progress'].includes(order.status)) {
      throw new Error('Order cannot be completed from current status');
    }

    // === CALCULATE FREELANCER FEE (5% deducted at completion) ===
    const platformFee = Math.round(order.grossAmount * 0.05 * 100) / 100; // 5% fee
    const netAmount = order.grossAmount - platformFee; // What freelancer actually gets

    // === UPDATE ORDER ===
    order.status = 'completed';
    order.completedAt = new Date();
    order.escrowReleased = true;
    order.platformFee = platformFee; // Update with actual fee
    order.netAmount = netAmount; // Update with actual payout
    await order.save({ session, validateBeforeSave: false });

    // === FIND OR CREATE PAYMENT ===
    let payment = await Payment.findOne({ order: orderId }).session(session);

    if (!payment) {
      // Create payment if doesn't exist
      payment = await Payment.create(
        [
          {
            order: orderId,
            payer: order.client._id,
            payee: order.freelancer._id,
            grossAmount: order.grossAmount,
            platformFee: platformFee,
            netAmount: netAmount,
            status: 'released',
            type: 'order_payment',
            releasedAt: new Date(),
          },
        ],
        { session }
      );
      payment = payment[0];
    } else {
      // Update existing payment with calculated fee
      payment.platformFee = platformFee;
      payment.netAmount = netAmount;
      payment.status = 'released';
      payment.releasedAt = new Date();
      await payment.save({ session, validateBeforeSave: false });
    }

    // === UPDATE FREELANCER STATS ===
    const freelancer = await User.findByIdAndUpdate(
      order.freelancer._id,
      {
        $inc: {
          totalGrossEarned: order.grossAmount,
          totalFeesPaid: platformFee,
          totalEarned: netAmount,
          completedJobs: 1,
          walletBalance: netAmount,
          pendingEarnings: -Math.max(order.grossAmount, 0), // Remove full gross amount from pending
        },
      },
      { session, new: true }
    );

    if (!freelancer) {
      throw new Error('Freelancer not found');
    }

    // === UPDATE CLIENT STATS ===
    // Release client's budget allocation and record as spent
    const client = await User.findByIdAndUpdate(
      order.client._id,
      {
        $inc: {
          budgetAllocated: -order.grossAmount,
          totalSpent: order.grossAmount,
        },
      },
      { session, new: true }
    );

    if (!client) {
      throw new Error('Client not found');
    }

    // === COMMIT TRANSACTION ===
    await session.commitTransaction();

    // === POST-TRANSACTION NOTIFICATIONS ===
    // Notify freelancer of completion
    await sendNotification(order.freelancer._id, {
      type: 'order_completed',
      title: '✅ Order Completed!',
      message: `Order #${orderId.toString().slice(-6)} completed. Amount: $${order.grossAmount} | Fee: $${platformFee} (5%) | You receive: $${netAmount}. Balance: $${freelancer.walletBalance}`,
      link: `/orders/${orderId}`,
    });

    // Notify client
    await sendNotification(order.client._id, {
      type: 'order_completed',
      title: '✅ Order Completed',
      message: `Order #${orderId.toString().slice(-6)} with ${order.freelancer.fullName} completed successfully.`,
      link: `/orders/${orderId}`,
    });

    // === LOG ACTIVITY ===
    await logActivity(
      userId,
      'complete_order',
      'Order',
      orderId,
      `Completed order. Freelancer earned: $${order.netAmount}. Payment released.`,
      ip,
      false
    );

    return {
      success: true,
      order,
      payment,
      freelancer,
      message: 'Order completed successfully!',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * MARK ORDER AS DELIVERED
 * (Can be done by freelancer before completing)
 */
exports.submitDeliverable = async (orderId, userId, deliverables = [], ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId)
      .populate('freelancer')
      .session(session);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.freelancer._id.toString() !== userId.toString()) {
      throw new Error('Only freelancer can submit deliverables');
    }

    if (order.status !== 'in_progress') {
      throw new Error('Cannot submit deliverables for this order');
    }

    // Update order
    order.status = 'delivered';
    order.deliveredAt = new Date();
    order.deliverables = deliverables;
    await order.save({ session, validateBeforeSave: false });

    await session.commitTransaction();

    // Notify client
    await sendNotification(order.client, {
      type: 'order_delivered',
      title: '📦 Deliverables Submitted',
      message: `${order.freelancer.fullName} submitted deliverables for order #${orderId.toString().slice(-6)}`,
      link: `/orders/${orderId}`,
    });

    await logActivity(userId, 'submit_deliverable', 'Order', orderId, 'Submitted deliverables', ip);

    return {
      success: true,
      order,
      message: 'Deliverables submitted successfully!',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * CANCEL ORDER WITH REFUND
 */
exports.cancelOrder = async (orderId, userId, cancelReason, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId)
      .populate('client')
      .populate('freelancer')
      .session(session);

    if (!order) {
      throw new Error('Order not found');
    }

    const isClient = order.client._id.toString() === userId.toString();
    const isFreelancer = order.freelancer._id.toString() === userId.toString();

    if (!isClient && !isFreelancer) {
      throw new Error('Not authorized to cancel this order');
    }

    if (['completed', 'cancelled'].includes(order.status)) {
      throw new Error(`Cannot cancel order with status: ${order.status}`);
    }

    // Calculate refund
    const refundAmount = order.grossAmount;

    // === UPDATE ORDER ===
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = cancelReason;
    order.refundAmount = refundAmount;
    await order.save({ session, validateBeforeSave: false });

    // === CREATE REFUND PAYMENT ===
    const refundPayment = await Payment.create(
      [
        {
          order: orderId,
          payer: order.freelancer._id,
          payee: order.client._id,
          grossAmount: refundAmount,
          platformFee: 0, // Refunds don't incur additional fees
          netAmount: refundAmount,
          status: 'refunded',
          type: 'refund',
          refundedAt: new Date(),
        },
      ],
      { session }
    );

    // === REVERT FREELANCER STATS (if order was completed) ===
    if (order.status === 'completed') {
      await User.findByIdAndUpdate(
        order.freelancer._id,
        {
          $inc: {
            totalEarned: -order.netAmount,
            completedJobs: -1,
            walletBalance: -order.netAmount,
          },
        },
        { session }
      );
    }

    // === REVERT CLIENT STATS ===
    // Refund escrow amount to client wallet and release budget allocation
    await User.findByIdAndUpdate(
      order.client._id,
      {
        $inc: {
          totalSpent: -order.grossAmount,
          walletBalance: order.grossAmount,
          budgetAllocated: -order.grossAmount,
        },
      },
      { session }
    );

    await session.commitTransaction();

    // === NOTIFICATIONS ===
    await sendNotification(order.client._id, {
      type: 'order_cancelled',
      title: '❌ Order Cancelled',
      message: `Order #${orderId.toString().slice(-6)} has been cancelled. Refund of $${refundAmount} initiated.`,
      link: `/orders/${orderId}`,
    });

    await sendNotification(order.freelancer._id, {
      type: 'order_cancelled',
      title: '❌ Order Cancelled',
      message: `Order #${orderId.toString().slice(-6)} has been cancelled. Reason: ${cancelReason}`,
      link: `/orders/${orderId}`,
    });

    await logActivity(
      userId,
      'cancel_order',
      'Order',
      orderId,
      `Cancelled order. Reason: ${cancelReason}. Refund: $${refundAmount}`,
      ip
    );

    return {
      success: true,
      order,
      refund: refundPayment[0],
      message: 'Order cancelled and refund initiated',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * GET USER'S ORDERS
 */
exports.getUserOrders = async (userId, role, page = 1, limit = 12, status = null) => {
  const skip = (page - 1) * limit;
  const query = {};

  // Filter by user role
  if (role === 'freelancer') {
    query.freelancer = userId;
  } else if (role === 'client') {
    query.client = userId;
  }

  if (status) {
    query.status = status;
  }

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('client', 'fullName profileImage companyName')
      .populate('freelancer', 'fullName profileImage title')
      .populate('job', 'title')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Order.countDocuments(query),
  ]);

  return {
    success: true,
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * GET ORDER DETAILS
 */
exports.getOrderDetails = async (orderId, userId) => {
  const order = await Order.findById(orderId)
    .populate('client', 'fullName profileImage email companyName')
    .populate('freelancer', 'fullName profileImage email title')
    .populate('job', 'title description')
    .populate('offer', 'title description');

  if (!order) throw new Error('Order not found');

  // Verify authorization
  const isClient = order.client && order.client._id.toString() === userId.toString();
  const isFreelancer = order.freelancer && order.freelancer._id.toString() === userId.toString();

  if (!isClient && !isFreelancer) {
    throw new Error('Not authorized to view this order');
  }

  return {
    success: true,
    order,
  };
};
