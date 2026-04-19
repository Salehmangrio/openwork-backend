// ============================================================
// controllers/offerController.js — Offer management with services
// ============================================================
const offerService = require('../services/offerService');
const { cloudinary } = require('../middleware/upload');

/**
 * PURCHASE OFFER
 * @route   POST /api/offers/:id/purchase
 * @access  Private (Client)
 * 
 * Cascade Updates:
 * - Create order
 * - Create escrow payment
 * - Update offer totalOrders++
 * - Update user stats
 */
exports.purchaseOffer = async (req, res, next) => {
  try {
    const { packageName, quantity = 1 } = req.body;

    if (!packageName) {
      return res.status(400).json({ success: false, message: 'Package name required' });
    }

    const result = await offerService.purchaseOffer(
      req.params.id,
      packageName,
      req.user._id,
      quantity,
      req.ip
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET OFFER STATS (Seller only)
 * @route   GET /api/offers/:id/stats
 * @access  Private (Offer seller)
 */
exports.getOfferStats = async (req, res, next) => {
  try {
    const result = await offerService.getOfferStats(req.params.id, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET ORDERS FOR SELLER'S OFFERS
 * @route   GET /api/offers/seller/orders
 * @access  Private (Seller)
 */
exports.getSellerOfferOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const status = req.query.status;

    const result = await offerService.getSellerOfferOrders(
      req.user._id,
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
 * GET ORDERS FOR BUYER'S PURCHASES
 * @route   GET /api/offers/buyer/orders
 * @access  Private (Buyer)
 */
exports.getBuyerOfferOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const status = req.query.status;

    const result = await offerService.getBuyerOfferOrders(
      req.user._id,
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
 * REQUEST REVISION FOR OFFER ORDER
 * @route   POST /api/offers/orders/:orderId/request-revision
 * @access  Private (Buyer/Client)
 */
exports.requestRevision = async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Revision reason required' });
    }

    const result = await offerService.requestRevision(
      req.params.orderId,
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
 * CREATE OFFER (Seller)
 * @route   POST /api/offers
 * @access  Private (Seller/Freelancer)
 */
exports.createOffer = async (req, res, next) => {
  try {
    if (req.user.role !== 'freelancer' && !req.user.canActAsFreelancer) {
      return res.status(403).json({ success: false, message: 'Only freelancers can create offers' });
    }

    req.body.seller = req.user._id;
    const { Offer } = require('../models/index');
    const offer = await Offer.create(req.body);

    res.status(201).json({ success: true, offer });
  } catch (err) {
    next(err);
  }
};

/**
 * GET ALL OFFERS (Public)
 * @route   GET /api/offers
 * @access  Public
 */
exports.getOffers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const { Offer } = require('../models/index');

    const query = { status: 'active', isApproved: true };
    if (req.query.category) query.category = req.query.category;
    if (req.query.search) query.$text = { $search: req.query.search };

    const skip = (page - 1) * limit;

    const [offers, total] = await Promise.all([
      Offer.find(query)
        .populate('seller', 'fullName profileImage aiSkillScore averageRating location totalReviews title')
        .sort(req.query.sort === 'rating' ? '-avgRating' : '-createdAt')
        .skip(skip)
        .limit(limit),
      Offer.countDocuments(query),
    ]);

    res.json({ success: true, count: offers.length, total, offers });
  } catch (err) {
    next(err);
  }
};

/**
 * GET OFFER DETAILS
 * @route   GET /api/offers/:id
 * @access  Public
 */
exports.getOffer = async (req, res, next) => {
  try {
    const { Offer } = require('../models/index');
    const offer = await Offer.findById(req.params.id).populate(
      'seller',
      'fullName profileImage aiSkillScore averageRating totalReviews completedJobs location bio'
    );

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    offer.viewCount += 1;
    await offer.save({ validateBeforeSave: false });

    res.json({ success: true, offer });
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE OFFER (Seller only)
 * @route   PUT /api/offers/:id
 * @access  Private (Offer seller)
 */
exports.updateOffer = async (req, res, next) => {
  try {
    const { Offer } = require('../models/index');
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    if (offer.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Delete old thumbnail from Cloudinary if being replaced
    if (offer.offerThumbnail?.publicId && req.body.offerThumbnail?.publicId !== offer.offerThumbnail.publicId) {
      try {
        await cloudinary.uploader.destroy(offer.offerThumbnail.publicId);
      } catch (deleteErr) {
        console.error('Error deleting old thumbnail:', deleteErr);
        // Continue even if deletion fails
      }
    }

    // Delete thumbnail if explicitly set to null
    if (req.body.offerThumbnail === null && offer.offerThumbnail?.publicId) {
      try {
        await cloudinary.uploader.destroy(offer.offerThumbnail.publicId);
      } catch (deleteErr) {
        console.error('Error deleting thumbnail:', deleteErr);
        // Continue even if deletion fails
      }
    }

    const updated = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, offer: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * GET SELLER'S OFFERS
 * @route   GET /api/offers/seller/my-offers
 * @access  Private (Seller)
 */
exports.getMyOffers = async (req, res, next) => {
  try {
    const { Offer } = require('../models/index');
    const offers = await Offer.find({ seller: req.user._id }).sort('-createdAt');
    res.json({ success: true, offers });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE OFFER (Seller only)
 * @route   DELETE /api/offers/:id
 * @access  Private (Offer seller)
 */
exports.deleteOffer = async (req, res, next) => {
  try {
    const { Offer } = require('../models/index');
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    if (offer.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Delete thumbnail from Cloudinary if it exists
    if (offer.offerThumbnail?.publicId) {
      try {
        await cloudinary.uploader.destroy(offer.offerThumbnail.publicId);
      } catch (deleteErr) {
        console.error('Error deleting thumbnail:', deleteErr);
        // Continue even if deletion fails
      }
    }

    // Delete all images from Cloudinary
    if (offer.images && offer.images.length > 0) {
      for (const image of offer.images) {
        if (image.publicId) {
          try {
            await cloudinary.uploader.destroy(image.publicId);
          } catch (deleteErr) {
            console.error('Error deleting image:', deleteErr);
            // Continue even if deletion fails
          }
        }
      }
    }

    await Offer.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Offer deleted' });
  } catch (err) {
    next(err);
  }
};

