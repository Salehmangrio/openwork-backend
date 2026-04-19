
const mongoose = require('mongoose');
const { Payment, Order, User, Notification } = require('../models/index');
const { logActivity, sendNotification } = require('../utils/helpers');

// ════════════════════════════════════════════════════════════
// PAYMENT SERVICE — Payment Processing & Escrow Management
// ════════════════════════════════════════════════════════════
// NOTE: Fee calculation functions are in utils/paymentCalculations.js

/**
 * RELEASE PAYMENT FROM ESCROW
 * 
 * FEE STRUCTURE:
 * - When order is created: platformFee = 0 (client pays nothing extra)
 * - When escrow is released: 5% fee is deducted from freelancer's earnings
 * 
 * Cascade Updates:
 * 1. Calculate 5% platform fee on grossAmount
 * 2. Update payment status to "released" and set platformFee
 * 3. Update freelancer:
 *    - totalGrossEarned += grossAmount
 *    - totalFeesPaid += calculated platformFee (5%)
 *    - totalEarned += netAmount (after fee deduction)
 *    - walletBalance += netAmount (after fee deduction)
 *    - pendingEarnings -= grossAmount
 * 4. Update order.escrowReleased = true
 */
exports.releaseEscrowPayment = async (paymentId, userId, ip, isAdmin = false) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // === FETCH & VALIDATE ===
    const payment = await Payment.findById(paymentId)
      .populate('order')
      .populate('payee')
      .populate('payer')
      .session(session);

    if (!payment) {
      await session.abortTransaction();
      throw new Error('Payment not found');
    }

    // Only admin or order client can release
    if (!isAdmin && payment.payer.toString() !== userId.toString()) {
      await session.abortTransaction();
      throw new Error('Not authorized to release this payment');
    }

    if (payment.status !== 'held_in_escrow') {
      await session.abortTransaction();
      throw new Error(`Payment is already ${payment.status}`);
    }

    if (!payment.order) {
      await session.abortTransaction();
      throw new Error('Associated order not found');
    }

    // === CALCULATE FREELANCER FEE (5% deducted at release) ===
    const platformFee = Math.round(payment.grossAmount * 0.05 * 100) / 100; // 5% fee
    const netAmount = payment.grossAmount - platformFee; // What freelancer actually gets

    // === UPDATE PAYMENT ===
    // Set the fee and net amount that were calculated at release time
    payment.platformFee = platformFee;
    payment.netAmount = netAmount;
    payment.status = 'released';
    payment.releasedAt = new Date();
    await payment.save({ session, validateBeforeSave: false });

    // === UPDATE ORDER ===
    const order = payment.order;
    order.escrowReleased = true;
    order.platformFee = platformFee; // Update order with actual fee
    order.netAmount = netAmount; // Update order with actual payout
    await order.save({ session, validateBeforeSave: false });

    // === UPDATE FREELANCER WALLET & EARNINGS ===
    const freelancer = await User.findByIdAndUpdate(
      payment.payee._id,
      {
        $inc: {
          totalGrossEarned: payment.grossAmount,
          totalFeesPaid: platformFee,
          totalEarned: netAmount,
          walletBalance: netAmount,
          pendingEarnings: -payment.grossAmount, // Remove full gross from pending
        },
      },
      { session, new: true }
    );

    if (!freelancer) {
      await session.abortTransaction();
      throw new Error('Freelancer not found');
    }

    // === UPDATE CLIENT ===
    // Release client's budget allocation and record as spent
    const client = await User.findByIdAndUpdate(
      payment.payer._id,
      {
        $inc: {
          budgetAllocated: -payment.grossAmount,
          totalSpent: payment.grossAmount,
        },
      },
      { session, new: true }
    );

    if (!client) {
      await session.abortTransaction();
      throw new Error('Client not found');
    }

    await session.commitTransaction();

    // === NOTIFICATIONS ===
    await sendNotification(payment.payee, {
      type: 'payment_released',
      title: '💰 Payment Released!',
      message: `Order amount: $${payment.grossAmount} | Platform fee: $${platformFee} (5%) | You receive: $${netAmount}. Balance: $${freelancer.walletBalance}`,
      link: `/dashboard/payments`,
    });

    await sendNotification(payment.payer, {
      type: 'payment_released',
      title: '✅ Escrow Released',
      message: `Payment of $${payment.grossAmount} for order #${payment.order._id.toString().slice(-6)} released to freelancer (after 5% platform fee).`,
      link: `/dashboard/orders/${payment.order._id}`,
    });

    // === LOG ACTIVITY ===
    await logActivity(
      userId,
      'release_escrow_payment',
      'Payment',
      paymentId,
      `Gross: $${payment.grossAmount} | Fee (5%): $${platformFee} | Freelancer net: $${netAmount}`,
      ip,
      isAdmin
    );

    return {
      success: true,
      payment,
      freelancer,
      order,
      message: `Payment released! Freelancer received $${payment.netAmount} (after $${payment.platformFee} fee)`,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * PROCESS REFUND
 * 
 * Cascade Updates:
 * 1. Create refund payment record
 * 2. Update original payment status to "refunded"
 * 3. Revert freelancer stats
 */
exports.processRefund = async (orderId, userId, refundAmount, reason, ip, isAdmin = false) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // === FETCH & VALIDATE ===
    const order = await Order.findById(orderId)
      .populate('client')
      .populate('freelancer')
      .session(session);

    if (!order) {
      await session.abortTransaction();
      throw new Error('Order not found');
    }

    const isClient = order.client._id.toString() === userId.toString();

    if (!isAdmin && !isClient) {
      await session.abortTransaction();
      throw new Error('Not authorized to refund this order');
    }

    if (!['in_progress', 'delivered'].includes(order.status)) {
      await session.abortTransaction();
      throw new Error('Cannot refund order with current status');
    }

    const maxRefund = order.grossAmount;
    if (refundAmount <= 0 || refundAmount > maxRefund) {
      await session.abortTransaction();
      throw new Error(`Refund amount must be between $0.01 and $${maxRefund}`);
    }

    // === FIND ORIGINAL PAYMENT ===
    let payment = await Payment.findOne({ order: orderId, type: 'order_payment' }).session(session);

    if (!payment) {
      await session.abortTransaction();
      throw new Error('Payment record not found');
    }

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
          status: 'released', // Refunds auto-complete
          type: 'refund',
          refundedAt: new Date(),
        },
      ],
      { session }
    );

    // === UPDATE ORIGINAL PAYMENT ===
    payment.status = 'refunded';
    payment.refundedAt = new Date();
    await payment.save({ session, validateBeforeSave: false });

    // === REVERT FREELANCER EARNINGS (if order was completed) ===
    if (order.status === 'completed') {
      await User.findByIdAndUpdate(
        order.freelancer._id,
        {
          $inc: {
            walletBalance: -refundAmount,
            totalEarned: -refundAmount,
          },
        },
        { session }
      );
    }

    // === REVERT CLIENT SPENDING ===
    await User.findByIdAndUpdate(
      order.client._id,
      {
        $inc: {
          totalSpent: -refundAmount,
        },
      },
      { session }
    );

    // === UPDATE ORDER ===
    order.refundAmount = (order.refundAmount || 0) + refundAmount;
    order.refundReason = reason;
    await order.save({ session, validateBeforeSave: false });

    await session.commitTransaction();

    // === NOTIFICATIONS ===
    await sendNotification(order.client._id, {
      type: 'payment_refunded',
      title: '💸 Refund Processed',
      message: `Refund of $${refundAmount} processed for order #${orderId.toString().slice(-6)}. Reason: ${reason}`,
      link: `/orders/${orderId}`,
    });

    await sendNotification(order.freelancer._id, {
      type: 'payment_refunded',
      title: 'Refund Issued',
      message: `Refund of $${refundAmount} issued for order #${orderId.toString().slice(-6)}. Reason: ${reason}`,
      link: `/orders/${orderId}`,
    });

    await logActivity(
      userId,
      'process_refund',
      'Payment',
      refundPayment[0]._id,
      `Refund of $${refundAmount} processed. Reason: ${reason}`,
      ip,
      isAdmin
    );

    return {
      success: true,
      refundPayment: refundPayment[0],
      originalPayment: payment,
      order,
      message: `Refund of $${refundAmount} processed successfully`,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * GET PAYMENT HISTORY
 */
exports.getPaymentHistory = async (userId, role, page = 1, limit = 20, status = null) => {
  const skip = (page - 1) * limit;
  const query = {};

  // Filter based on role
  if (role === 'freelancer') {
    query.payee = userId;
  } else if (role === 'client') {
    query.payer = userId;
  }

  if (status) {
    query.status = status;
  }

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate('order', 'title grossAmount status')
      .populate('payer', 'fullName')
      .populate('payee', 'fullName')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(query),
  ]);

  console.log('=== Backend Payment History Debug ===');
  console.log('Query:', query);
  console.log('Raw payments count:', payments.length);
  if (payments.length > 0) {
    console.log('First payment raw:', payments[0].toObject());
  }

  // Add backward compatibility for old payment records
  const normalizedPayments = payments.map(payment => {
    const paymentObj = payment.toObject();
    // If old field 'amount' exists but grossAmount doesn't, calculate the fields
    if (paymentObj.amount && !paymentObj.grossAmount) {
      const gross = paymentObj.amount;
      const fee = paymentObj.platformFee || Math.round(gross * 0.05 * 100) / 100;
      paymentObj.grossAmount = gross;
      paymentObj.platformFee = fee;
      paymentObj.netAmount = gross - fee;
      console.log('Normalized payment from old structure:', { amount: gross, platformFee: fee, netAmount: gross - fee });
    }
    return paymentObj;
  });

  console.log('Normalized payments count:', normalizedPayments.length);
  if (normalizedPayments.length > 0) {
    console.log('First normalized payment:', normalizedPayments[0]);
  }

  return {
    success: true,
    payments: normalizedPayments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * GET WALLET BALANCE
 */
exports.getWalletBalance = async (userId) => {
  const user = await User.findById(userId).select('walletBalance pendingEarnings');

  if (!user) throw new Error('User not found');

  return {
    success: true,
    walletBalance: user.walletBalance,
    pendingEarnings: user.pendingEarnings,
    totalAvailable: user.walletBalance + user.pendingEarnings,
  };
};

/**
 * WITHDRAW FROM WALLET
 */
exports.withdrawWallet = async (userId, withdrawAmount, bankDetails, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (withdrawAmount <= 0) {
      await session.abortTransaction();
      throw new Error('Withdrawal amount must be positive');
    }

    const user = await User.findById(userId).session(session);

    if (!user) {
      await session.abortTransaction();
      throw new Error('User not found');
    }

    if (user.walletBalance < withdrawAmount) {
      await session.abortTransaction();
      throw new Error('Insufficient wallet balance');
    }

    // === CREATE WITHDRAWAL PAYMENT ===
    const withdrawal = await Payment.create(
      [
        {
          payer: userId,
          payee: userId,
          grossAmount: withdrawAmount,
          platformFee: 0, // Withdrawals don't have platform fees
          netAmount: withdrawAmount,
          status: 'pending',
          type: 'withdrawal',
          method: 'bank',
          metadata: bankDetails,
        },
      ],
      { session }
    );

    // === DEDUCT FROM WALLET (pending until confirmed) ===
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          walletBalance: -withdrawAmount,
          pendingEarnings: withdrawAmount, // Move to pending
        },
      },
      { session, new: true }
    );

    await session.commitTransaction();

    await sendNotification(userId, {
      type: 'withdrawal_initiated',
      title: 'Withdrawal Initiated',
      message: `Withdrawal of $${withdrawAmount} initiated. It will arrive in 3-5 business days.`,
      link: `/wallet`,
    });

    await logActivity(userId, 'withdraw_wallet', 'Payment', withdrawal[0]._id, `Withdrew $${withdrawAmount}`, ip);

    return {
      success: true,
      withdrawal: withdrawal[0],
      newBalance: updatedUser.walletBalance,
      message: 'Withdrawal initiated successfully',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * GET PAYMENT DETAILS
 */
exports.getPaymentDetails = async (paymentId, userId) => {
  const payment = await Payment.findById(paymentId)
    .populate('order')
    .populate('payer', 'fullName email')
    .populate('payee', 'fullName email');

  if (!payment) throw new Error('Payment not found');

  // Verify authorization
  const isPayee = payment.payee._id.toString() === userId.toString();
  const isPayer = payment.payer._id.toString() === userId.toString();

  if (!isPayee && !isPayer) {
    throw new Error('Not authorized to view this payment');
  }

  // Add backward compatibility for old payment records
  const paymentObj = payment.toObject();
  if (paymentObj.amount && !paymentObj.grossAmount) {
    const gross = paymentObj.amount;
    const fee = paymentObj.platformFee || Math.round(gross * 0.05 * 100) / 100;
    paymentObj.grossAmount = gross;
    paymentObj.platformFee = fee;
    paymentObj.netAmount = gross - fee;
  }

  return {
    success: true,
    payment: paymentObj,
  };
};
