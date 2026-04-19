// ============================================================
// utils/paymentCalculations.js
// Payment calculation functions — BACKEND ONLY
// 
// FEE STRUCTURE:
// - Client pays: 0% fee (grossAmount is the full order value)
// - Freelancer pays: 5% fee when order is completed and payment is released
// ============================================================

/**
 * Calculate payment amounts - NO FEE AT ORDER CREATION
 * Called when orders are created - client pays exact amount, 0% fee
 * @param {Number} amount - Order amount (full amount, no fee added)
 * @returns {Object} { grossAmount, platformFee: 0, netAmount }
 * 
 * Example:
 * calculatePaymentAmounts(100) → { grossAmount: 100, platformFee: 0, netAmount: 100 }
 */
function calculatePaymentAmounts(amount) {
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  const gross = Number(amount.toFixed(2));

  return {
    grossAmount: Number(gross.toFixed(2)),
    platformFee: 0, // No fee charged to client at order creation
    netAmount: Number(gross.toFixed(2)), // Freelancer gets full amount initially
  };
}

/**
 * Calculate freelancer payout at escrow release - DEDUCT 5% FEE FROM FREELANCER
 * Called when order is completed and escrow is released
 * @param {Number} grossAmount - Order amount (before freelancer fee deduction)
 * @returns {Object} { grossAmount, platformFee, netAmount (what freelancer actually gets) }
 * 
 * Example:
 * calculateFreelancerPayout(100) → { grossAmount: 100, platformFee: 5, netAmount: 95 }
 */
function calculateFreelancerPayout(grossAmount) {
  if (!grossAmount || typeof grossAmount !== 'number' || grossAmount <= 0) {
    throw new Error('Gross amount must be a positive number');
  }

  const gross = Number(grossAmount.toFixed(2));
  const fee = Math.round(gross * 5) / 100; // 5% fee, rounded to cents
  const net = gross - fee;

  return {
    grossAmount: Number(gross.toFixed(2)),
    platformFee: Number(fee.toFixed(2)), // 5% fee deducted from freelancer
    netAmount: Number(net.toFixed(2)), // What freelancer actually receives
  };
}


/**
 * Validate payment amounts - for orders with 0% client fee
 * @param {Number} grossAmount
 * @param {Number} platformFee (should be 0 for new orders)
 * @param {Number} netAmount
 * @returns {Boolean}
 * @throws {Error} if amounts don't match validation rules
 */
function validatePaymentAmounts(grossAmount, platformFee, netAmount) {
  if (grossAmount <= 0) throw new Error('Gross amount must be > 0');
  if (platformFee < 0) throw new Error('Platform fee cannot be negative');
  if (netAmount < 0) throw new Error('Net amount cannot be negative');

  // For new orders: platformFee should be 0, netAmount should equal grossAmount
  if (platformFee === 0) {
    if (Math.abs(netAmount - grossAmount) > 0.01) {
      throw new Error(`Net amount mismatch: expected $${grossAmount}, got $${netAmount}`);
    }
  } else {
    // For released orders: platformFee should be exactly 5%
    const expectedFee = Math.round(grossAmount * 5) / 100;
    if (Math.abs(platformFee - expectedFee) > 0.01) {
      throw new Error(`Platform fee mismatch: expected $${expectedFee}, got $${platformFee}`);
    }
    // Check: gross - fee = net (allow 1 cent rounding)
    const expectedNet = grossAmount - platformFee;
    if (Math.abs(netAmount - expectedNet) > 0.01) {
      throw new Error(`Net amount mismatch: expected $${expectedNet}, got $${netAmount}`);
    }
  }

  return true;
}

/**
 * Calculate earnings breakdown for frontend display
 * @param {Number} totalGrossEarned
 * @param {Number} totalFeesPaid
 * @param {Number} totalEarned
 * @returns {Object}
 */
function calculateEarningsBreakdown(totalGrossEarned, totalFeesPaid, totalEarned) {
  return {
    totalGrossEarned: Number(totalGrossEarned.toFixed(2)),
    totalFeesPaid: Number(totalFeesPaid.toFixed(2)),
    totalEarned: Number(totalEarned.toFixed(2)),
    feePercentage: totalGrossEarned > 0 ? ((totalFeesPaid / totalGrossEarned) * 100).toFixed(2) : '0.00',
  };
}

/**
 * Calculate withdrawal details
 * @param {Number} walletBalance
 * @param {Number} withdrawalAmount
 * @returns {Object}
 * @throws {Error} if withdrawal exceeds balance
 */
function calculateWithdrawal(walletBalance, withdrawalAmount) {
  if (withdrawalAmount <= 0) {
    throw new Error('Withdrawal amount must be greater than 0');
  }

  if (withdrawalAmount > walletBalance) {
    throw new Error(`Insufficient balance: $${walletBalance} available, $${withdrawalAmount} requested`);
  }

  if (withdrawalAmount < 50) {
    throw new Error('Minimum withdrawal amount is $50');
  }

  return {
    withdrawalAmount: Number(withdrawalAmount.toFixed(2)),
    newBalance: Number((walletBalance - withdrawalAmount).toFixed(2)),
  };
}

/**
 * Format payment object for API response
 * Ensures frontend receives only the values we want to display
 * @param {Object} payment - Payment document
 * @returns {Object}
 */
function formatPaymentResponse(payment) {
  return {
    _id: payment._id,
    order: payment.order,
    payer: payment.payer,
    payee: payment.payee,
    grossAmount: payment.grossAmount,
    platformFee: payment.platformFee,
    netAmount: payment.netAmount,
    currency: payment.currency,
    status: payment.status,
    type: payment.type,
    createdAt: payment.createdAt,
    // Do NOT include: stripePaymentIntentId, stripeChargeId, secret keys
  };
}

/**
 * Format user earnings for API response
 * @param {Object} user - User document
 * @returns {Object}
 */
function formatUserEarningsResponse(user) {
  return {
    totalGrossEarned: user.totalGrossEarned || 0,
    totalFeesPaid: user.totalFeesPaid || 0,
    totalEarned: user.totalEarned || 0,
    walletBalance: user.walletBalance || 0,
    pendingEarnings: user.pendingEarnings || 0,
    withdrawnTotal: user.withdrawnTotal || 0,
  };
}

module.exports = {
  calculatePaymentAmounts,
  calculateFreelancerPayout,
  validatePaymentAmounts,
  calculateEarningsBreakdown,
  calculateWithdrawal,
  formatPaymentResponse,
  formatUserEarningsResponse,
};
