const mongoose = require('mongoose');
const { Review, User, Order } = require('../models/index');
const { logActivity, sendNotification } = require('../utils/helpers');

/**
 * CREATE REVIEW
 */
exports.createReview = async (orderId, userId, reviewData, ip) => {
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

    // Determine reviewer and reviewee
    const isClient = order.client._id.toString() === userId.toString();
    const isFreelancer = order.freelancer._id.toString() === userId.toString();

    if (!isClient && !isFreelancer) {
      await session.abortTransaction();
      throw new Error('Only order participants can leave reviews');
    }

    const reviewee = isClient ? order.freelancer : order.client;

    // Check if review already exists
    const existing = await Review.findOne({
      order: orderId,
      reviewer: userId,
    }).session(session);

    if (existing) {
      await session.abortTransaction();
      throw new Error('You have already reviewed this order');
    }

    // Create review
    const review = await Review.create(
      [
        {
          order: orderId,
          job: order.job || null,
          offer: order.offer || null,
          reviewer: userId,
          reviewee: reviewee._id,
          rating: reviewData.rating,
          comment: reviewData.comment,
          categories: reviewData.categories || {},
          reviewType: isClient ? 'client_to_freelancer' : 'freelancer_to_client',
          isPublic: reviewData.isPublic !== false,
        },
      ],
      { session }
    );

    // Recalculate user average rating
    const reviews = await Review.find({ reviewee: reviewee._id }).session(session);
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
      : 0;

    await User.findByIdAndUpdate(
      reviewee._id,
      {
        averageRating: avgRating,
        totalReviews: reviews.length,
      },
      { session }
    );

    await session.commitTransaction();

    // Notify reviewee
    await sendNotification(reviewee._id, {
      type: 'review_received',
      title: `⭐ ${isClient ? 'Client' : 'Freelancer'} Left a Review`,
      message: `You received a ${reviewData.rating}-star review for order #${orderId.toString().slice(-6)}${reviewData.comment ? `: "${reviewData.comment.slice(0, 50)}"` : ''}`,
      link: `/reviews/${review[0]._id}`,
    });

    await logActivity(
      userId,
      'create_review',
      'Review',
      review[0]._id,
      `Left ${reviewData.rating}-star review`,
      ip
    );

    return {
      success: true,
      review: review[0],
      message: 'Review created successfully',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * GET USER REVIEWS
 */
exports.getUserReviews = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find({ reviewee: userId })
      .populate('reviewer', 'fullName profileImage title')
      .populate('order', 'title')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Review.countDocuments({ reviewee: userId }),
  ]);

  return {
    success: true,
    reviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * GET REVIEWS GIVEN BY USER (as reviewer)
 */
exports.getMyGivenReviews = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find({ reviewer: userId })
      .populate('reviewee', 'fullName profileImage title')
      .populate('order', 'title')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Review.countDocuments({ reviewer: userId }),
  ]);

  return {
    success: true,
    reviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * UPDATE REVIEW (Add seller response)
 */
exports.updateReview = async (reviewId, userId, updateData, ip) => {
  const review = await Review.findById(reviewId);

  if (!review) throw new Error('Review not found');

  if (review.reviewee.toString() !== userId.toString()) {
    throw new Error('Only reviewee can respond to review');
  }

  review.sellerResponse = updateData.sellerResponse;
  review.sellerRespondedAt = new Date();
  await review.save();

  await logActivity(userId, 'respond_review', 'Review', reviewId, 'Added response', ip);

  return {
    success: true,
    review,
    message: 'Response added',
  };
};

/**
 * GET REVIEWS BY OFFER
 */
exports.getOfferReviews = async (offerId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find({ offer: offerId, isPublic: true })
      .populate('reviewer', 'fullName profileImage title aiSkillScore')
      .populate('order', 'title')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Review.countDocuments({ offer: offerId, isPublic: true }),
  ]);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
    : 0;

  return {
    success: true,
    reviews,
    avgRating,
    totalReviews: total,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * DELETE REVIEW (Admin only)
 */
exports.deleteReview = async (reviewId, userId, ip, isAdmin = false) => {
  if (!isAdmin) throw new Error('Admin only');

  const review = await Review.findById(reviewId);
  if (!review) throw new Error('Review not found');

  const reviewee = review.reviewee;
  await Review.findByIdAndDelete(reviewId);

  // Recalculate average
  const reviews = await Review.find({ reviewee });
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
    : 0;

  await User.findByIdAndUpdate(
    reviewee,
    {
      averageRating: avgRating,
      totalReviews: reviews.length,
    }
  );

  await logActivity(userId, 'delete_review', 'Review', reviewId, 'Deleted review', ip, true);

  return { success: true, message: 'Review deleted' };
};
