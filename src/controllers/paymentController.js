// ============================================================
// controllers/paymentController.js — Payment & Wallet management
// ============================================================
const paymentService = require('../services/paymentService');

/**
 * RELEASE ESCROW PAYMENT
 * @route   POST /api/payments/:id/release
 * @access  Private (Order client OR Admin)
 */
exports.releaseEscrow = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const result = await paymentService.releaseEscrowPayment(
      req.params.id,
      req.user._id,
      req.ip,
      isAdmin
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * PROCESS REFUND
 * @route   POST /api/orders/:orderId/refund
 * @access  Private (Order client OR Admin)
 */
exports.processRefund = async (req, res, next) => {
  try {
    const { refundAmount, reason } = req.body;
    const isAdmin = req.user.role === 'admin';

    if (!refundAmount || refundAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid refund amount' });
    }

    const result = await paymentService.processRefund(
      req.params.orderId,
      req.user._id,
      refundAmount,
      reason,
      req.ip,
      isAdmin
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET PAYMENT HISTORY
 * @route   GET /api/payments
 * @access  Private
 * @query   page, limit, status
 */
exports.getPaymentHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    const result = await paymentService.getPaymentHistory(
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
 * GET WALLET BALANCE
 * @route   GET /api/wallet/balance
 * @access  Private
 */
exports.getWalletBalance = async (req, res, next) => {
  try {
    const result = await paymentService.getWalletBalance(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * WITHDRAW FROM WALLET
 * @route   POST /api/wallet/withdraw
 * @access  Private (Freelancer)
 */
exports.withdrawWallet = async (req, res, next) => {
  try {
    const { withdrawAmount, bankDetails } = req.body;

    if (!withdrawAmount || withdrawAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }

    if (!bankDetails) {
      return res.status(400).json({ success: false, message: 'Bank details required' });
    }

    const result = await paymentService.withdrawWallet(
      req.user._id,
      withdrawAmount,
      bankDetails,
      req.ip
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET PAYMENT DETAILS
 * @route   GET /api/payments/:id
 * @access  Private (Payment payer/payee)
 */
exports.getPaymentDetails = async (req, res, next) => {
  try {
    const result = await paymentService.getPaymentDetails(req.params.id, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET ESCROW BALANCE (Admin)
 * @route   GET /api/admin/escrow-balance
 * @access  Private (Admin only)
 */
exports.getEscrowBalance = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { Payment } = require('../models/index');
    const escrowPayments = await Payment.find({ status: 'held_in_escrow' });

    // FIX 4: Use grossAmount (current field name) instead of the old 'amount' field.
    // Previously this always summed to 0 for any payment created after the schema
    // was migrated from 'amount' → 'grossAmount'.
    const totalEscrow = escrowPayments.reduce((sum, p) => sum + (p.grossAmount || p.amount || 0), 0);
    const count = escrowPayments.length;

    res.json({
      success: true,
      totalEscrow,
      count,
      payments: escrowPayments,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * REFUND TRANSACTION (Admin)
 * @route   POST /api/admin/payments/:id/refund
 * @access  Private (Admin only)
 */
exports.adminRefund = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { reason = 'Admin refund' } = req.body;
    const { Payment, Order } = require('../models/index');

    const payment = await Payment.findById(req.params.id).populate('order');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const order = payment.order;
    if (!order) {
      return res.status(404).json({ success: false, message: 'Associated order not found' });
    }

    const result = await paymentService.processRefund(
      order._id,
      req.user._id,
      payment.netAmount,
      reason,
      req.ip,
      true
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ════════════════════════════════════════════════════════════
// PAYFAST WALLET TOP-UP ENDPOINTS
// ════════════════════════════════════════════════════════════

/**
 * INITIATE WALLET TOP-UP WITH PAYFAST
 * @route   POST /api/payments/wallet/topup
 * @access  Private
 */
exports.initiateWalletTopup = async (req, res, next) => {
  try {
    const { amount, returnUrl } = req.body;
    const payfastService = require('../services/payfastService');

    console.log('🔍 Initiating wallet top-up...');
    console.log('  User:', req.user._id);
    console.log('  Amount:', amount);

    const validation = payfastService.validateTopupAmount(amount);
    if (!validation.valid) {
      console.warn('⚠️  Amount validation failed:', validation.message);
      return res.status(400).json({
        success: false,
        message: validation.message || 'Invalid amount',
      });
    }

    const result = await payfastService.createWalletTopUp(
      req.user._id,
      validation.amount,
      returnUrl
    );

    console.log('✅ PayFast Top-up initiated successfully');
    console.log('  Payment ID:', result.paymentId);
    console.log('  Amount:', validation.amount);
    console.log('  PayFast URL:', result.paymentUrl);
    console.log('  Form fields count:', Object.keys(result.data).length);

    res.json({
      success: true,
      paymentId: result.paymentId,
      amount: validation.amount,
      currency: 'ZAR',
      redirectUrl: result.paymentUrl,
      payfastData: result.data,
    });
  } catch (err) {
    console.error('❌ PayFast top-up error:', err.message);
    console.error('   Stack:', err.stack);

    if (err.message.includes('credentials')) {
      return res.status(500).json({
        success: false,
        message: 'PayFast payment gateway is not configured. Please contact support.',
        error: err.message,
      });
    }

    if (err.message.includes('User not found')) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    next(err);
  }
};

/**
 * PAYFAST CALLBACK HANDLER
 * @route   POST /api/payments/payfast/callback
 * @access  Public (PayFast server only)
 */
exports.payfastCallback = async (req, res, next) => {
  try {
    const payfastService = require('../services/payfastService');

    console.log('\n📨 PAYFAST CALLBACK RECEIVED');
    console.log(`   Payment ID: ${req.body.m_payment_id}`);
    console.log(`   Status: ${req.body.payment_status}`);
    console.log(`   Amount: ${req.body.amount_gross}`);

    const result = await payfastService.processPayfastCallback(req.body);

    console.log(`✅ CALLBACK PROCESSED: Success=${result.success}\n`);

    if (result.success) {
      res.json({
        success: true,
        message: 'Wallet top-up processed successfully',
        paymentId: result.paymentId,
        newBalance: result.newBalance,
      });
    } else {
      res.json({
        success: false,
        message: result.message,
        reason: result.reason,
      });
    }
  } catch (err) {
    console.error('❌ PayFast callback error:', err.message);
    // Return 200 so PayFast doesn't keep retrying
    res.status(200).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * VERIFY PAYFAST TRANSACTION
 * @route   POST /api/payments/payfast/verify/:paymentId
 * @access  Private
 */
exports.verifyPayfastTransaction = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const payfastService = require('../services/payfastService');

    const result = await payfastService.verifyPayfastTransaction(paymentId);

    res.json({
      success: result.success,
      data: result.data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET WALLET TOP-UP HISTORY
 * @route   GET /api/payments/wallet/topup-history
 * @access  Private
 */
exports.getWalletTopupHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const payfastService = require('../services/payfastService');

    const result = await payfastService.getWalletTopupHistory(req.user._id, page, limit);

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * CONFIRM TOPUP FROM RETURN URL
 * @route   POST /api/payments/wallet/topup/confirm
 * @access  Private
 * @body    paymentId
 *
 * Called by the frontend success page after PayFast redirects back.
 * This is the fallback for when ITN (notify_url) cannot reach localhost
 * in development. In production this is a safety net only — ITN handles it.
 */
exports.confirmTopupFromReturn = async (req, res, next) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'paymentId is required' });
    }

    const payfastService = require('../services/payfastService');
    const result = await payfastService.confirmTopupFromReturn(paymentId, req.user._id);

    res.json(result);
  } catch (err) {
    next(err);
  }
};