const mongoose = require('mongoose');

const MilestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  amount: { type: Number, required: true, min: 0 },
  dueDate: Date,
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'submitted', 'approved', 'disputed'],
    default: 'pending',
  },
  submittedAt: Date,
  approvedAt: Date,
  deliverables: [{ url: String, name: String, publicId: String }],
});

const JobSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, maxlength: 5000 },
    category: {
      type: String,
      required: true,
      enum: [
        'Web Development', 'Mobile Development', 'UI/UX Design',
        'Graphic Design', 'Data Science / AI', 'Content Writing',
        'Digital Marketing', 'Video & Animation', 'DevOps & Cloud',
        'Cybersecurity', 'Blockchain', 'Other',
      ],
    },
    skills: [{ type: String, trim: true }],
    budgetType: { type: String, enum: ['fixed', 'hourly'], default: 'fixed' },
    budgetMin: { type: Number, required: true, min: 0 },
    budgetMax: { type: Number, required: true, min: 0 },
    duration: {
      type: String,
      enum: ['< 1 week', '1–2 weeks', '1 month', '2–3 months', '3+ months', 'ongoing'],
    },
    experienceLevel: {
      type: String,
      enum: ['entry', 'mid', 'senior', 'any'],
      default: 'any',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'completed', 'cancelled', 'paused'],
      default: 'open',
    },
    visibility: { type: String, enum: ['public', 'invite_only'], default: 'public' },
    isUrgent: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },

    // ── Hired Freelancer ─────────────────────────────────────
    hiredFreelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hiredAt: Date,

    // ── Milestones ───────────────────────────────────────────
    milestones: [MilestoneSchema],

    // ── Attachments ──────────────────────────────────────────
    attachments: [{ url: String, name: String, publicId: String }],

    // ── Stats ────────────────────────────────────────────────
    proposalCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },

    // ── AI ───────────────────────────────────────────────────
    aiMatchTags: [String],
    aiDescription: String, // AI-enhanced description

    // ── Flags ────────────────────────────────────────────────
    isFlagged: { type: Boolean, default: false },
    flagReason: String,

    // ── Soft Delete ──────────────────────────────────────────
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletionReason: String,

    deadline: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────
JobSchema.index({ status: 1, category: 1 });
JobSchema.index({ client: 1 });
JobSchema.index({ skills: 1 });
JobSchema.index({ budgetMin: 1, budgetMax: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index({ isUrgent: 1 });
JobSchema.index({ '$**': 'text' });

module.exports = mongoose.model('Job', JobSchema);
