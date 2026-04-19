const express = require('express');
const r = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { createDispute, getMyDisputes, resolveDispute } = require('../controllers/disputeController');
r.post('/order/:orderId', protect, createDispute);
r.get('/my', protect, getMyDisputes);
r.put('/:id/resolve', protect, adminOnly, resolveDispute);
module.exports = r;
