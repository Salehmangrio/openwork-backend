const express = require('express');
const r = express.Router();
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { createOrderRules, updateOrderStatusRules } = require('../middleware/requestValidators');
const { createOrder, createCustomOrder, acceptCustomOrder, getUserOrders, getOrderDetails, completeOrder, submitDeliverable, cancelOrder, requestRevision, updateProgress } = require('../controllers/orderController');

r.post('/', protect, createOrder);

r.post('/custom', protect, createCustomOrder);

r.post('/:id/accept', protect, acceptCustomOrder);
r.get('/my', protect, getUserOrders);
r.get('/:id', protect, getOrderDetails);
r.post('/:id/complete', protect, completeOrder);
r.post('/:id/deliverables', protect, submitDeliverable);
r.post('/:id/cancel', protect, cancelOrder);
r.post('/:id/request-revision', protect, requestRevision);
r.put('/:id/progress', protect, updateProgress);

module.exports = r;
