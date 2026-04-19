const orderService = require('../services/orderService');
const { Order, Job, User, Payment, Offer } = require('../models/index');
const mongoose = require('mongoose');

/**
 * CREATE ORDER (Direct checkout from job or offer)
 * @route   POST /api/orders
 * @access  Private (Client)
 */


/**
 * CREATE CUSTOM ORDER (Proposal from Freelancer)
 * @route   POST /api/orders/custom
 * @access  Private (Freelancer)
 */
exports.createCustomOrder = async (req, res, next) => {
  try {
    const { title, totalAmount, clientId, deliveryDays = 30, description } = req.body;
    const freelancerId = req.user._id;

    if (!title || !totalAmount || !clientId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ success: false, message: 'Only freelancers can create custom orders' });
    }

    // FEE STRUCTURE: Client pays 0%, freelancer will pay 5% when order completes
    const orderData = {
      client: clientId,
      freelancer: freelancerId,
      title,
      grossAmount: totalAmount,
      platformFee: 0, // Client pays 0% at order creation
      netAmount: totalAmount, // Full amount (no fee deducted yet)
      deliveryDate: new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000),
      status: 'pending_acceptance',
      escrowReleased: false,
      description
    };

    const order = await Order.create(orderData);

    res.status(201).json({
      success: true,
      message: 'Custom order proposed successfully',
      order,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ACCEPT CUSTOM ORDER (By Client)
 * @route   POST /api/orders/:id/accept
 * @access  Private (Client)
 */
exports.acceptCustomOrder = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const clientId = req.user._id;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);

      if (!order) throw new Error('Order not found');
      if (order.client.toString() !== clientId.toString()) {
        throw new Error('Not authorized to accept this order');
      }
      if (order.status !== 'pending_acceptance') {
        throw new Error('Order is not pending acceptance');
      }

      const client = await User.findById(clientId).session(session);
      if (client.walletBalance < order.grossAmount) {
        throw new Error('Insufficient wallet balance');
      }

      // Create payment record
      const payment = await Payment.create(
        [{
          order: orderId,
          payer: clientId,
          payee: order.freelancer,
          grossAmount: order.grossAmount,
          platformFee: order.platformFee,
          netAmount: order.netAmount,
          status: 'held_in_escrow',
          type: 'order_payment',
          method: 'wallet',
        }],
        { session }
      );

      order.payment = payment[0]._id;
      order.status = 'in_progress';
      await order.save({ session });

      // Deduct from client wallet and add to escrow (budgetAllocated)
      await User.findByIdAndUpdate(
        clientId,
        {
          $inc: {
            walletBalance: -order.grossAmount,
            budgetAllocated: order.grossAmount,
          },
        },
        { session }
      );

      // Increment freelancer's pendingEarnings (escrow tracking)
      await User.findByIdAndUpdate(
        order.freelancer,
        {
          $inc: {
            pendingEarnings: order.grossAmount,
          },
        },
        { session }
      );

      await session.commitTransaction();

      res.status(200).json({
        success: true,
        message: 'Order accepted successfully',
        order,
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    next(err);
  }
};




exports.createOrder = async (req, res, next) => {
  try {
    const { title, totalAmount, jobId, offerId, freelancerId, packageName, deliveryDays = 30, description } = req.body;
    const clientId = req.user._id;

    if (!title || !totalAmount || !freelancerId) {
      return res.status(400).json({ success: false, message: 'Missing required fields: title, totalAmount, freelancerId' });
    }

    // Validate: Only clients can order offers
    if (offerId && req.user.role !== 'client') {
      return res.status(403).json({ success: false, message: 'Only clients can purchase offers' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Verify client has sufficient wallet balance
      const client = await User.findById(clientId).session(session);
      if (!client) {
        throw new Error('Client not found');
      }
      if (client.walletBalance === 0) {
        throw new Error('Wallet balance is zero. Please add funds to place an order.');
      }
      if (client.walletBalance < totalAmount) {
        throw new Error(`Insufficient wallet balance. Required: $${totalAmount}, Available: $${client.walletBalance}`);
      }

      // Verify freelancer exists
      const freelancer = await User.findById(freelancerId).session(session);
      if (!freelancer || freelancer.role !== 'freelancer') {
        throw new Error('Invalid freelancer');
      }

      // Create order
      // FEE STRUCTURE: Client pays 0%, freelancer will pay 5% when order completes
      const platformFee = 0; // Client pays 0% at order creation
      const netAmount = totalAmount; // Full amount (no fee deducted yet)

      const orderData = {
        client: clientId,
        freelancer: freelancerId,
        title,
        grossAmount: totalAmount,
        platformFee,
        netAmount,
        deliveryDate: new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000),
        status: 'in_progress',
        escrowReleased: false,
      };

      // Add description if provided (for direct orders)
      if (description) {
        orderData.description = description;
      }

      // Add job or offer specifics
      if (jobId) {
        const job = await Job.findById(jobId).session(session);
        if (!job) throw new Error('Job not found');
        if (job.client.toString() !== clientId.toString()) {
          throw new Error('Not authorized - only job client can create order');
        }
        orderData.job = jobId;
        orderData.description = job.description; // Job description overrides provided description
      }

      if (offerId) {
        const offer = await Offer.findById(offerId).session(session);
        if (!offer) throw new Error('Offer not found');
        // Offer is valid - client is authorized to purchase any active offer
        if (offer.status !== 'active') {
          throw new Error('This offer is not available for purchase');
        }
        orderData.offer = offerId;
        if (packageName) orderData.packageName = packageName;
      }

      const order = await Order.create([orderData], { session });

      // Create payment record (held in escrow)
      const payment = await Payment.create(
        [
          {
            order: order[0]._id,
            payer: clientId,
            payee: freelancerId,
            grossAmount: totalAmount,
            platformFee,
            netAmount,
            status: 'held_in_escrow',
            type: 'order_payment',
            method: 'wallet',
          },
        ],
        { session }
      );

      // Link payment to order
      order[0].payment = payment[0]._id;
      await order[0].save({ session });

      // Deduct from client wallet and add to escrow (budgetAllocated)
      await User.findByIdAndUpdate(
        clientId,
        {
          $inc: {
            walletBalance: -totalAmount,
            budgetAllocated: totalAmount,
          },
        },
        { session }
      );

      // Increment freelancer's pendingEarnings (escrow tracking)
      await User.findByIdAndUpdate(
        freelancerId,
        {
          $inc: {
            pendingEarnings: totalAmount,
          },
        },
        { session }
      );

      await session.commitTransaction();

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        order: order[0],
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    next(err);
  }
};

/**
 * COMPLETE ORDER
 * @route   POST /api/orders/:id/complete
 * @access  Private (Order client/freelancer)
 * 
 * Cascade Updates:
 * - Order status → completed
 * - Payment status → released
 * - Freelancer wallet updated
 * - User stats updated
 */
exports.completeOrder = async (req, res, next) => {
  try {
    const result = await orderService.completeOrder(
      req.params.id,
      req.user._id,
      req.user.role === 'freelancer',
      req.ip
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * SUBMIT DELIVERABLE
 * @route   POST /api/orders/:id/deliverables
 * @access  Private (Freelancer)
 */
exports.submitDeliverable = async (req, res, next) => {
  try {
    const { deliverables = [] } = req.body;
    const result = await orderService.submitDeliverable(
      req.params.id,
      req.user._id,
      deliverables,
      req.ip
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * CANCEL ORDER
 * @route   POST /api/orders/:id/cancel
 * @access  Private (Order client/freelancer)
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const { reason = 'No reason provided' } = req.body;
    const result = await orderService.cancelOrder(
      req.params.id,
      req.user._id,
      reason,
      req.ip
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET USER'S ORDERS
 * @route   GET /api/orders
 * @access  Private
 * @query   page, limit, status
 */
exports.getUserOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const status = req.query.status;

    const result = await orderService.getUserOrders(
      req.user._id,
      req.user.role,
      page,
      limit,
      status
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET ORDER DETAILS
 * @route   GET /api/orders/:id
 * @access  Private (Order participants)
 */
exports.getOrderDetails = async (req, res, next) => {
  try {
    const result = await orderService.getOrderDetails(req.params.id, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * REQUEST REVISION
 * @route   POST /api/orders/:id/request-revision
 * @access  Private (Client)
 */
exports.requestRevision = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const Order = require('../models/index').Order;
    const order = await Order.findById(req.params.id).populate('freelancer');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.revisionsUsed >= order.revisionsAllowed) {
      return res.status(400).json({ success: false, message: 'Revision limit reached' });
    }

    order.status = 'revision_requested';
    order.revisionRequests.push({ reason, requestedAt: new Date() });
    order.revisionsUsed += 1;
    await order.save();

    // Notify freelancer
    const { sendNotification } = require('../utils/helpers');
    await sendNotification(order.freelancer, {
      type: 'revision_requested',
      title: '🔄 Revision Requested',
      message: `Client requested revisions. Reason: ${reason}`,
      link: `/orders/${order._id}`,
    });

    res.json({ success: true, order, message: 'Revision requested' });
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE ORDER PROGRESS
 * @route   PUT /api/orders/:id/progress
 * @access  Private (Freelancer)
 */
exports.updateProgress = async (req, res, next) => {
  try {
    const { progress, note } = req.body;
    const Order = require('../models/index').Order;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.freelancer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (progress < 0 || progress > 100) {
      return res.status(400).json({ success: false, message: 'Progress must be 0-100' });
    }

    order.progress = progress;
    if (note) order.freelancerNote = note;
    await order.save();

    res.json({ success: true, order, message: 'Progress updated' });
  } catch (err) {
    next(err);
  }
};
