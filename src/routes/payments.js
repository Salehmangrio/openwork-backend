const express = require('express');
const r = express.Router();
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { withdrawRules } = require('../middleware/requestValidators');
const { releaseEscrow, processRefund, getPaymentHistory, getWalletBalance, withdrawWallet, getPaymentDetails, getEscrowBalance, adminRefund, initiateWalletTopup, payfastCallback, verifyPayfastTransaction, getWalletTopupHistory, confirmTopupFromReturn } = require('../controllers/paymentController');
const { getPaymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod, setDefaultPaymentMethod } = require('../controllers/paymentMethodController');
const { addPaymentMethodRules, deletePaymentMethodRules, setDefaultPaymentMethodRules } = require('../middleware/validators/paymentValidators');

// ═══ Wallet Routes ═══════════════════════════════════════
r.post('/wallet/withdraw', protect, withdrawRules, handleValidation, withdrawWallet);
r.get('/wallet/balance', protect, getWalletBalance);

// ═══ PayFast Wallet Top-up Routes ═══════════════════════
r.post('/wallet/topup', protect, initiateWalletTopup);
r.get('/wallet/topup-history', protect, getWalletTopupHistory);
r.post('/wallet/topup/confirm', protect, confirmTopupFromReturn); // Frontend fallback for when ITN can't reach localhost
r.post('/payfast/callback', payfastCallback); // Public endpoint for PayFast notifications
r.post('/payfast/verify/:paymentId', protect, verifyPayfastTransaction);

// ═══ Payment Methods Routes (MUST come before /:id) ══════
r.get('/methods', protect, getPaymentMethods);
r.post('/methods', protect, addPaymentMethodRules, handleValidation, addPaymentMethod);
r.put('/methods/:id', protect, updatePaymentMethod);
r.delete('/methods/:id', protect, deletePaymentMethod);
r.put('/methods/:id/default', protect, setDefaultPaymentMethod);

// ═══ Admin Routes ════════════════════════════════════════
r.get('/admin/escrow-balance', protect, getEscrowBalance);
r.post('/admin/:id/refund', protect, adminRefund);

// ═══ Payment Routes (Specific before Generic) ════════════
r.post('/:id/release', protect, releaseEscrow);
r.post('/:orderId/refund', protect, processRefund);

// ═══ Generic Routes (MUST come last) ═════════════════════
r.get('/', protect, getPaymentHistory);
r.get('/:id', protect, getPaymentDetails);

module.exports = r;