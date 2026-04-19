
const mongoose = require('mongoose');
const { Order, Payment, Offer, User, Notification } = require('../models/index');
const { logActivity, sendNotification } = require('../utils/helpers');

/**
 * PURCHASE OFFER FLOW
 * 
 * Cascade Updates:
 * 1. Create Order from offer
 * 2. Create Payment (escrow) for offer
 * 3. Update offer totalOrders++
 * 4. Update seller stats (optional)
 * 5. Update buyer stats (totalSpent += amount)
 * 6. Send notifications
 */
exports.purchaseOffer = async (offerId, packageName, userId, quantity = 1, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // === FETCH & VALIDATE OFFER ===
    const offer = await Offer.findById(offerId)
      .populate('seller')
      .session(session);

    if (!offer) {
      await session.abortTransaction();
      throw new Error('Offer not found');
    }

    if (offer.status !== 'active' || !offer.isApproved) {
      await session.abortTransaction();
      throw new Error('This offer is not available for purchase');
    }

    if (offer.seller._id.toString() === userId.toString()) {
      await session.abortTransaction();
      throw new Error('You cannot purchase your own offer');
    }

    // === VALIDATE PACKAGE ===
    const selectedPackage = offer.packages.find((pkg) => pkg.name === packageName);

    if (!selectedPackage) {
      await session.abortTransaction();
      throw new Error('Selected package not found');
    }

    // === CALCULATE AMOUNT ===
    const packagePrice = selectedPackage.price;
    const totalAmount = packagePrice * quantity;
    // FEE STRUCTURE: Client pays 0%, freelancer will pay 5% when order completes
    const platformFee = 0; // No fee charged to client
    const sellerPayout = totalAmount; // Full amount initially (fee deducted at release)

    // === CREATE ORDER ===
    const order = await Order.create(
      [
        {
          offer: offerId,
          client: userId,
          freelancer: offer.seller._id,
          title: offer.title,
          description: offer.description,
          packageName: packageName,
          grossAmount: totalAmount,
          platformFee,
          netAmount: sellerPayout,
          deliveryDate: new Date(
            Date.now() + selectedPackage.deliveryDays * 24 * 60 * 60 * 1000
          ),
          status: 'in_progress',
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
          payer: userId,
          payee: offer.seller._id,
          grossAmount: totalAmount,
          platformFee: platformFee,
          netAmount: sellerPayout,
          status: 'held_in_escrow',
          type: 'order_payment',
          method: 'stripe',
        },
      ],
      { session }
    );

    // === UPDATE OFFER ===
    offer.totalOrders = (offer.totalOrders || 0) + quantity;
    await offer.save({ session, validateBeforeSave: false });

    // === UPDATE CLIENT STATS ===
    await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          totalSpent: totalAmount,
        },
      },
      { session }
    );

    // === UPDATE SELLER STATS (optional) ===
    await User.findByIdAndUpdate(
      offer.seller._id,
      {
        $inc: {
          totalJobs: 1, // Count as a job
        },
      },
      { session }
    );

    await session.commitTransaction();

    // === POST-TRANSACTION NOTIFICATIONS ===
    // Notify seller
    await sendNotification(offer.seller._id, {
      type: 'order_created',
      title: '🎉 New Order!',
      message: `${quantity} order(s) for "${offer.title}" (${packageName}). Order #${order[0]._id.toString().slice(-6)}. Payment: $${totalAmount} held in escrow.`,
      link: `/orders/${order[0]._id}`,
    });

    // Notify buyer
    const buyer = await User.findById(userId);
    await sendNotification(userId, {
      type: 'order_created',
      title: '✅ Order Created',
      message: `Order #${order[0]._id.toString().slice(-6)} placed with ${offer.seller.fullName}. Delivery in ${selectedPackage.deliveryDays} days.`,
      link: `/orders/${order[0]._id}`,
    });

    // === LOG ACTIVITY ===
    await logActivity(
      userId,
      'purchase_offer',
      'Offer',
      offerId,
      `Purchased ${quantity}x "${offer.title}" (${packageName}). Order: #${order[0]._id.toString().slice(-6)}. Amount: $${totalAmount}`,
      ip
    );

    return {
      success: true,
      order: order[0],
      payment: payment[0],
      offer,
      message: 'Offer purchased successfully!',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * GET SELLER'S OFFER STATS
 */
exports.getOfferStats = async (offerId, userId) => {
  const offer = await Offer.findById(offerId).populate('seller');

  if (!offer) throw new Error('Offer not found');

  if (offer.seller._id.toString() !== userId.toString()) {
    throw new Error('Not authorized - only seller can view stats');
  }

  // Get orders for this offer
  const orders = await Order.find({ offer: offerId });
  const completedOrders = orders.filter((o) => o.status === 'completed').length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.freelancerPayout, 0);

  return {
    success: true,
    stats: {
      totalOrders: offer.totalOrders,
      completedOrders,
      avgRating: offer.avgRating,
      totalReviews: offer.totalReviews,
      totalRevenue,
      viewCount: offer.viewCount,
    },
  };
};

/**
 * GET ORDERS FOR BUYER'S OFFERS
 * (Show orders placed for offers user is selling)
 */
exports.getSellerOfferOrders = async (userId, page = 1, limit = 12, status = null) => {
  // First get offers by this seller
  const sellerOffers = await Offer.find({ seller: userId }).select('_id');
  const offerIds = sellerOffers.map((o) => o._id);

  const query = { offer: { $in: offerIds } };
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('client', 'fullName profileImage')
      .populate('offer', 'title')
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
 * GET BUYER'S OFFER ORDERS
 * (Show orders placed by user)
 */
exports.getBuyerOfferOrders = async (userId, page = 1, limit = 12, status = null) => {
  const query = { client: userId, offer: { $exists: true, $ne: null } };
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('freelancer', 'fullName profileImage title')
      .populate('offer', 'title')
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
 * REQUEST REVISION FOR OFFER ORDER
 */
exports.requestRevision = async (orderId, userId, reason, ip) => {
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

    if (!order.offer) {
      await session.abortTransaction();
      throw new Error('This is not an offer-based order');
    }

    if (order.client._id.toString() !== userId.toString()) {
      await session.abortTransaction();
      throw new Error('Only order client can request revisions');
    }

    if (order.revisionsUsed >= order.revisionsAllowed) {
      await session.abortTransaction();
      throw new Error('Revision limit reached');
    }

    if (!['delivered', 'in_progress'].includes(order.status)) {
      await session.abortTransaction();
      throw new Error('Cannot request revision for current order status');
    }

    // === UPDATE ORDER ===
    order.status = 'revision_requested';
    order.revisionRequests.push({ reason, requestedAt: new Date() });
    order.revisionsUsed += 1;
    await order.save({ session, validateBeforeSave: false });

    await session.commitTransaction();

    // === NOTIFICATION ===
    await sendNotification(order.freelancer._id, {
      type: 'revision_requested',
      title: '🔄 Revision Requested',
      message: `Client requested revisions for order #${orderId.toString().slice(-6)}. Reason: ${reason}`,
      link: `/orders/${orderId}`,
    });

    await logActivity(userId, 'request_revision', 'Order', orderId, `Requested revision. Reason: ${reason}`, ip);

    return {
      success: true,
      order,
      message: 'Revision requested successfully',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
