const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema(
  {
    // ── Core Identity ─────────────────────────────────────────
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    phone: { type: String, trim: true },
    profileImage: {
      type: String,
      default: '',
    },
    profileImagePublicId: { type: String },

    // ── Roles ────────────────────────────────────────────────
    role: {
      type: String,
      enum: ['freelancer', 'client', 'admin'],
      default: 'freelancer',
    },
    // Allows dual role (buyer + seller)
    canActAsClient: { type: Boolean, default: false },
    canActAsFreelancer: { type: Boolean, default: true },

    // ── Freelancer Profile ───────────────────────────────────
    title: { type: String, maxlength: 100, default: '' },
    bio: { type: String, maxlength: 1000, default: '' },
    skills: [{ type: String, trim: true }],
    hourlyRate: { type: Number, min: 0, default: 0 },
    experienceLevel: {
      type: String,
      enum: ['junior', 'mid', 'senior', 'expert'],
      default: 'mid',
    },
    portfolioUrl: { type: String, default: '' },
    portfolioFiles: [{ url: String, publicId: String, name: String }],
    location: { type: String, default: '' },
    languages: [{ language: String, level: String }],
    education: [{ school: String, degree: String, year: Number }],
    workHistory: [{ company: String, role: String, from: Date, to: Date, desc: String }],
    availability: {
      type: String,
      enum: ['available', 'busy', 'not_available'],
      default: 'available',
    },

    // ── Client Profile ───────────────────────────────────────
    companyName: { type: String, default: '' },
    companySize: { type: String, default: '' },
    organizationType: {
      type: String,
      enum: ['individual', 'startup', 'sme', 'enterprise', ''],
      default: '',
    },
    totalSpent: { type: Number, default: 0 }, budgetAllocated: { type: Number, default: 0 },
    
    // ── AI Scores & Analytics ────────────────────────────────
    aiSkillScore: { type: Number, default: 0, min: 0, max: 100 },
    aiRankScore: { type: Number, default: 0 },
    certifications: [
      {
        skill: String,
        score: Number,
        total: Number,
        pct: Number,
        passed: Boolean,
        takenAt: { type: Date, default: Date.now },
      },
    ],
    skillScoreHistory: [{ score: Number, date: { type: Date, default: Date.now } }],

    // ── Stats ────────────────────────────────────────────────
    totalEarned: { type: Number, default: 0 },
    totalJobs: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 }, // avg hours
    repeatClients: { type: Number, default: 0 },

    // ── Wallet / Payments ────────────────────────────────────
    // Earnings tracking (for freelancers)
    totalGrossEarned: { type: Number, default: 0 },      // Total before platform fee
    totalFeesPaid: { type: Number, default: 0 },         // Total 5% platform fees
    totalEarned: { type: Number, default: 0 },           // Net earnings (after fees)
    walletBalance: { type: Number, default: 0 },         // Available for withdrawal
    pendingEarnings: { type: Number, default: 0 },       // In escrow (not yet released)
    withdrawnTotal: { type: Number, default: 0 },        // Total withdrawn lifetime
    stripeCustomerId: { type: String },
    stripeAccountId: { type: String }, // for payouts
    paymentMethods: [
      {
        id: String,
        type: { type: String, enum: ['card', 'bank'], required: true },
        name: String,
        mask: String, // last 4 digits
        isDefault: { type: Boolean, default: false },
        provider: String, // stripe, paypal, etc
        metadata: mongoose.Schema.Types.Mixed,
        createdAt: { type: Date, default: Date.now }
      }
    ],

    // ── Email Verification ──────────────────────────────────
    emailVerified: { type: Boolean, default: false },
    emailOtp: { type: String, select: false },        // stores hashed OTP
    emailOtpExpires: { type: Date },
    emailOtpAttempts: { type: Number, default: 0 },
    emailVerifyToken: { type: String },
    emailVerifyExpires: { type: Date },
    
    // ── Phone Verification ──────────────────────────────────
    phoneVerified: { type: Boolean, default: false },
    phone: { type: String },
    phoneOtp: { type: String },        // stores hashed OTP
    phoneOtpExpires: { type: Date },


    // ── Auth & Security ──────────────────────────────────────
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    emailVerifyToken: { type: String, select: false },
    emailVerifyExpire: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },

    // ── Notification Preferences ─────────────────────────────
    notifPrefs: {
      messages: { type: Boolean, default: true },
      jobMatches: { type: Boolean, default: true },
      payments: { type: Boolean, default: true },
      disputes: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
    },

    // ── Social Logins ────────────────────────────────────────
    firebaseUid: { type: String, sparse: true }, // Firebase Auth UID (optional, for OAuth)
    googleId: { type: String },
    facebookId: { type: String },
    provider: { type: String, enum: ['email', 'google', 'facebook', 'firebase'] },

    // ── Fraud Detection ──────────────────────────────────────
    fraudFlags: [{ reason: String, severity: String, flaggedAt: Date }],
    fraudScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────
// email index is already created by unique: true constraint
UserSchema.index({ firebaseUid: 1, sparse: true });
UserSchema.index({ role: 1 });
UserSchema.index({ skills: 1 });
UserSchema.index({ aiRankScore: -1 });
UserSchema.index({ location: 1 });
UserSchema.index({ isActive: 1, isBanned: 1 });
UserSchema.index({ '$**': 'text' }); // full text search

// ─── Pre-save: Hash Password ─────────────────────────────────
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Method: Compare Password ────────────────────────────────
UserSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

// ─── Method: Generate JWT ────────────────────────────────────
UserSchema.methods.getSignedToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '15m' }
  );
};

// ─── Method: Generate Email Verify Token ─────────────────────
UserSchema.methods.getEmailVerifyToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerifyToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerifyExpire = Date.now() + 24 * 60 * 60 * 1000; // 24h
  return token;
};

// ─── Method: Generate Password Reset Token ───────────────────
UserSchema.methods.getResetPasswordToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1h
  return token;
};

// ─── Method: Recalculate AI Rank Score ───────────────────────
UserSchema.methods.recalcAIRank = function () {
  const w = { aiScore: 0.40, rating: 0.30, completion: 0.20, response: 0.10 };
  const completionRate = this.totalJobs > 0
    ? (this.completedJobs / this.totalJobs) * 100 : 0;
  const responseScore = this.responseTime > 0
    ? Math.max(0, 100 - this.responseTime * 5) : 50;
  this.aiRankScore =
    this.aiSkillScore * w.aiScore +
    (this.averageRating / 5) * 100 * w.rating +
    completionRate * w.completion +
    responseScore * w.response;
  return this.aiRankScore;
};

// ─── Virtual: initials ───────────────────────────────────────
UserSchema.virtual('initials').get(function () {
  return this.fullName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

UserSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', UserSchema);
