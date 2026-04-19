const mongoose = require('mongoose');

const createModel = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

const milestoneSchema = new mongoose.Schema({
  name: String,
  amount: Number,
  deadline: Date,
  status: { type: String, enum: ['pending', 'submitted', 'approved', 'released'], default: 'pending' },
}, { _id: false });

const packageSchema = new mongoose.Schema({
  name: String,
  price: Number,
  delivery_days: Number,
  description: String,
  revisions: Number,
  features: [String],
}, { _id: false });



const JobApplicationSchema = new mongoose.Schema({
  application_id: { type: String, unique: true, sparse: true },
  job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  freelancer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cover_letter: String,
  proposed_budget: Number,
  delivery_time: String,
  status: {
    type: String,
    enum: ['pending', 'viewed', 'shortlisted', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending',
  },
  ai_match_score: { type: Number, min: 0, max: 100 },
  applied_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });


const FeedbackSchema = new mongoose.Schema({
  feedback_id: { type: String, unique: true, sparse: true },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: String,
  communication_rating: { type: Number, min: 1, max: 5 },
  quality_rating: { type: Number, min: 1, max: 5 },
  would_recommend: { type: Boolean, default: true },
  is_public: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});

const AISkillTestSchema = new mongoose.Schema({
  test_id: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  category: String,
  icon: String,
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'], default: 'beginner' },
  time_limit_minutes: Number,
  points_on_pass: Number,
  pass_threshold: { type: Number, default: 60 },
  questions: [{
    question: String,
    options: [String],
    correct_index: Number,
    explanation: String,
    difficulty_weight: { type: Number, default: 1 },
  }],
  is_active: { type: Boolean, default: true },
  created_by_admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const AIRecommendationSchema = new mongoose.Schema({
  recommendation_id: { type: String, unique: true, sparse: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recommended_jobs: [{
    job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    match_score: Number,
    reasons: [String],
  }],
  algorithm_version: { type: String, default: 'v1' },
  generated_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const SkillTestResultSchema = new mongoose.Schema({
  result_id: { type: String, unique: true, sparse: true },
  test_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AISkillTest', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [mongoose.Schema.Types.Mixed],
  score: Number,
  passed: Boolean,
  time_taken_seconds: Number,
  per_question_results: [mongoose.Schema.Types.Mixed],
  ai_explanations: [String],
  created_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });


const JobApplication = createModel('JobApplication', JobApplicationSchema);
const Feedback = createModel('Feedback', FeedbackSchema);
const AISkillTest = createModel('AISkillTest', AISkillTestSchema);
const AIRecommendation = createModel('AIRecommendation', AIRecommendationSchema);
const SkillTestResult = createModel('SkillTestResult', SkillTestResultSchema);

module.exports = {
  JobApplication,
  Feedback,
  AISkillTest,
  AIRecommendation,
  SkillTestResult,
};
