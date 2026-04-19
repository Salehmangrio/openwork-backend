const express = require('express');
const r = express.Router();
const { protect } = require('../middleware/auth');
const { createReview, getUserReviews, getMyGivenReviews, getOfferReviews } = require('../controllers/reviewController');
r.post('/order/:orderId', protect, createReview);
r.get('/user/:userId', getUserReviews);
r.get('/offer/:offerId', getOfferReviews);
r.get('/my/given', protect, getMyGivenReviews);
module.exports = r;
