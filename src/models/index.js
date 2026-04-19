// ============================================================
// models/Offer.js — Open Offers (Gig-style service listings)
// ============================================================
const mongoose = require('mongoose');

const PackageSchema = new mongoose.Schema({
  name: { type: String, enum: ['basic', 'standard', 'premium'], required: true },
  title: String,
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 5 },
  deliveryDays: { type: Number, required: true, min: 1 },
  revisions: { type: Number, default: 1 },
  features: [String],
});

const OfferSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, maxlength: 3000 },
    category: { type: String, required: true },
    subcategory: String,
    tags: [String],
    packages: [PackageSchema],
    offerThumbnail: { url: String, publicId: String },
    images: [{ url: String, publicId: String }],
    faqs: [{ question: String, answer: String }],
    requirements: String,
    status: { type: String, enum: ['active', 'paused', 'rejected'], default: 'active' },
    isApproved: { type: Boolean, default: true },
    avgRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

OfferSchema.index({ seller: 1 });
OfferSchema.index({ category: 1, status: 1 });
OfferSchema.index({ avgRating: -1 });
OfferSchema.index({ '$**': 'text' });

const Offer = mongoose.model('Offer', OfferSchema);

// ============================================================
// models/Proposal.js — Job applications
// ============================================================
const ProposalSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coverLetter: { type: String, required: true, maxlength: 3000 },
    bidAmount: { type: Number, required: true, min: 1 },
    deliveryTime: { type: String, required: true },
    attachments: [{ url: String, name: String }],
    status: {
      type: String,
      enum: ['pending', 'viewed', 'shortlisted', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
    },
    isAIGenerated: { type: Boolean, default: false },
    clientNote: String,
  },
  { timestamps: true }
);

ProposalSchema.index({ job: 1, freelancer: 1 }, { unique: true });
ProposalSchema.index({ freelancer: 1 });
ProposalSchema.index({ status: 1 });

const Proposal = mongoose.model('Proposal', ProposalSchema);

// ============================================================
// models/Order.js — Active work contract
// ============================================================
const OrderSchema = new mongoose.Schema(
  {
    // Either from a Job or an Offer purchase
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    proposal: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal' },

    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    title: { type: String, required: true },
    description: String,
    packageName: { type: String, enum: ['basic', 'standard', 'premium', 'custom'] },

    // ── Financials ───────────────────────────────────────────
    grossAmount: { type: Number, required: true },      // Full order amount (before fee)
    platformFee: { type: Number, default: 0 },          // 5% platform fee
    netAmount: { type: Number, default: 0 },            // Freelancer receives (95%)
    escrowReleased: { type: Boolean, default: false },
    stripePaymentIntentId: String,
    stripeChargeId: String,
    refundAmount: { type: Number, default: 0 },
    refundReason: String,

    // ── Timeline ─────────────────────────────────────────────
    deliveryDate: Date,
    deliveredAt: Date,
    completedAt: Date,
    cancelledAt: Date,

    // ── Status ───────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'pending_acceptance', 'pending_payment', 'active', 'in_progress', 'delivered',
        'under_review', 'revision_requested', 'completed', 'cancelled', 'disputed',
      ],
      default: 'pending_payment',
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },

    // ── Milestones ───────────────────────────────────────────
    milestones: [
      {
        title: String,
        amount: Number,
        dueDate: Date,
        status: { type: String, enum: ['pending', 'submitted', 'approved', 'released'], default: 'pending' },
        submittedAt: Date,
        approvedAt: Date,
        escrowReleased: { type: Boolean, default: false },
        deliverables: [{ url: String, name: String }],
      },
    ],

    // ── Deliverables ─────────────────────────────────────────
    deliverables: [{ url: String, name: String, publicId: String, uploadedAt: Date }],

    // ── Revisions ────────────────────────────────────────────
    revisionsAllowed: { type: Number, default: 1 },
    revisionsUsed: { type: Number, default: 0 },
    revisionRequests: [{ reason: String, requestedAt: Date }],

    // ── Notes ────────────────────────────────────────────────
    clientNote: String,
    freelancerNote: String,
    cancelReason: String,
  },
  { timestamps: true }
);

OrderSchema.index({ client: 1 });
OrderSchema.index({ freelancer: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ job: 1 });

const Order = mongoose.model('Order', OrderSchema);

// ============================================================
// models/Message.js — Chat messages (conversations)
// ============================================================
const ConversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    lastActivity: { type: Date, default: Date.now },
    unreadCount: { type: Map, of: Number, default: {} },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastActivity: -1 });

const Conversation = mongoose.model('Conversation', ConversationSchema);

const MessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, maxlength: 5000 },
    messageType: {
      type: String,
      enum: ['text', 'file', 'image', 'offer', 'system'],
      default: 'text',
    },
    attachments: [{ url: String, name: String, type: String, publicId: String }],
    // Timestamp-based read status - null means unread
    readAt: { type: Date, default: null },
    // For group chats: track which users have read the message
    readBy: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      readAt: { type: Date, default: Date.now }
    }],
    // Optional delivery tracking
    deliveredAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  },
  { timestamps: true }
);

// Indexes for optimal query performance
MessageSchema.index({ conversation: 1, createdAt: -1 });
MessageSchema.index({ conversation: 1, readAt: 1 });
MessageSchema.index({ conversation: 1, 'readBy.userId': 1 });

const Message = mongoose.model('Message', MessageSchema);

// ============================================================
// models/Payment.js — Transactions
// ============================================================
const PaymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    payee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // ── Amounts (clear breakdown) ─────────────────────────────
    grossAmount: { type: Number, required: true },      // Full amount (before fee)
    platformFee: { type: Number, required: true },      // Exactly 5% of grossAmount
    netAmount: { type: Number, required: true },        // grossAmount - platformFee (95%)

    currency: { type: String, default: 'usd' },
    method: { type: String, enum: ['stripe', 'paypal', 'bank', 'wallet', 'fake_card', 'payfast'], default: 'stripe' },
    status: {
      type: String,
      enum: ['pending', 'held_in_escrow', 'released', 'refunded', 'failed', 'cancelled'],
      default: 'pending',
    },
    type: {
      type: String,
      enum: ['order_payment', 'escrow_release', 'refund', 'withdrawal', 'platform_fee', 'wallet_topup'],
    },
    stripePaymentIntentId: String,
    stripeChargeId: String,
    stripeTransferId: String,
    paypalOrderId: String,
    invoiceNumber: { type: String, unique: true, sparse: true },
    metadata: mongoose.Schema.Types.Mixed,
    refundedAt: Date,
    releasedAt: Date,
  },
  { timestamps: true }
);

PaymentSchema.index({ order: 1 });
PaymentSchema.index({ payer: 1 });
PaymentSchema.index({ payee: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ createdAt: -1 });

const Payment = mongoose.model('Payment', PaymentSchema);

// ============================================================
// models/Review.js — Ratings and feedback
// ============================================================
const ReviewSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
    categories: {
      communication: { type: Number, min: 1, max: 5 },
      quality: { type: Number, min: 1, max: 5 },
      expertise: { type: Number, min: 1, max: 5 },
      timeliness: { type: Number, min: 1, max: 5 },
    },
    reviewType: { type: String, enum: ['client_to_freelancer', 'freelancer_to_client'] },
    isPublic: { type: Boolean, default: true },
    sellerResponse: String,
    sellerRespondedAt: Date,
  },
  { timestamps: true }
);

ReviewSchema.index({ reviewee: 1 });
ReviewSchema.index({ order: 1 });
ReviewSchema.index({ job: 1 });
ReviewSchema.index({ offer: 1 });

const Review = mongoose.model('Review', ReviewSchema);

// ============================================================
// models/Dispute.js — Conflict resolution
// ============================================================
const DisputeSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    against: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: {
      type: String,
      enum: [
        'deliverable_mismatch', 'no_delivery', 'poor_quality',
        'no_communication', 'payment_issue', 'scope_creep', 'other',
      ],
      required: true,
    },
    description: { type: String, required: true, maxlength: 3000 },
    evidence: [{ url: String, name: String, publicId: String, uploadedBy: mongoose.Schema.Types.ObjectId }],
    status: {
      type: String,
      enum: ['pending', 'under_review', 'resolved_client', 'resolved_freelancer', 'cancelled'],
      default: 'pending',
    },
    resolution: String,
    resolutionType: { type: String, enum: ['full_refund', 'partial_refund', 'no_refund', 'revision', ''] },
    refundAmount: { type: Number, default: 0 },
    messages: [
      {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        content: String,
        sentAt: { type: Date, default: Date.now },
        isAdmin: { type: Boolean, default: false },
      },
    ],
    resolvedAt: Date,
    aiConfidenceScore: Number,
    aiFairnessSuggestion: String,
  },
  { timestamps: true }
);

DisputeSchema.index({ order: 1 });
DisputeSchema.index({ raisedBy: 1 });
DisputeSchema.index({ status: 1 });

const Dispute = mongoose.model('Dispute', DisputeSchema);

// ============================================================
// models/Notification.js — System notifications
// ============================================================
const NotificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional: who triggered the notification
    type: {
      type: String,
      enum: [
        'new_message', 'new_proposal', 'proposal_accepted', 'proposal_rejected',
        'order_created', 'order_delivered', 'order_completed', 'order_cancelled',
        'payment_received', 'payment_released', 'escrow_held',
        'review_received', 'dispute_opened', 'dispute_resolved',
        'job_match', 'skill_test_passed', 'profile_verified',
        'milestone_approved', 'milestone_submitted', 'system',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: String,
    category: { type: String, default: 'system' }, // For preference grouping
    isRead: { type: Boolean, default: false },
    readAt: Date,
    metadata: mongoose.Schema.Types.Mixed,
    sendEmail: { type: Boolean, default: false },
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ recipient: 1, type: 1 }); // For filtering by type

const Notification = mongoose.model('Notification', NotificationSchema);

// ============================================================
// models/ActivityLog.js — Full audit trail
// ============================================================
const ActivityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    resource: String,
    resourceId: mongoose.Schema.Types.ObjectId,
    details: String,
    ip: String,
    userAgent: String,
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    isAdminAction: { type: Boolean, default: false },
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

ActivityLogSchema.index({ user: 1 });
ActivityLogSchema.index({ action: 1 });
ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ severity: 1 });

const ActivityLog = mongoose.model('ActivityLog', ActivityLogSchema);

// ============================================================
// models/AIRankingConfig.js — AI Algorithm Ranking Weights
// ============================================================
const AIRankingConfigSchema = new mongoose.Schema({
  aiScore: { type: Number, default: 40, min: 0, max: 100 },
  rating: { type: Number, default: 30, min: 0, max: 100 },
  completion: { type: Number, default: 20, min: 0, max: 100 },
  response: { type: Number, default: 10, min: 0, max: 100 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Ensure weights always sum to 100
AIRankingConfigSchema.pre('save', function (next) {
  const total = this.aiScore + this.rating + this.completion + this.response;
  if (total !== 100) {
    throw new Error(`Weights must sum to 100. Current total: ${total}`);
  }
  next();
});

const AIRankingConfig = mongoose.model('AIRankingConfig', AIRankingConfigSchema);

const {
  JobApplication,
  Feedback,
  AISkillTest,
  AIRecommendation,
  SkillTestResult,
} = require('./sdsModels');

const Job = require('./Job');
const User = require('./User');
module.exports = {
  User, Job, Offer, Proposal, Order,
  Conversation, Message,
  Payment, Review, Dispute,
  Notification, ActivityLog,
  AIRankingConfig,
  JobApplication,
  Feedback, AISkillTest, AIRecommendation,
  SkillTestResult,
};
