// controllers/jobController.js
const Job = require('../models/Job');
const { Proposal, Notification, ActivityLog } = require('../models/index');
const User = require('../models/User');
const { logActivity, sendNotification } = require('../utils/helpers');
const APIFeatures = require('../utils/APIFeatures');

exports.createJob = async (req, res, next) => {
    try {
        req.body.client = req.user._id;
        const job = await Job.create(req.body);
        await logActivity(req.user._id, 'create_job', 'Job', job._id, `Posted: ${job.title}`, req.ip);

        res.status(201).json({ success: true, job });
    } catch (err) { next(err); }
};

exports.getJobs = async (req, res, next) => {
    try {
        const features = new APIFeatures(Job.find({ status: 'open' }), req.query).filter().sort().paginate();
        const jobs = await features.query.lean({ defaults: true });
        res.json({ success: true, count: jobs.length, jobs });
    } catch (err) { next(err); }
};

exports.getJob = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.id).populate('client').lean({ defaults: true });
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
        res.json({ success: true, job });
    } catch (err) { next(err); }
};

exports.updateJob = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.id);
        
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        // Authorization: Only the job's client or admin can update
        if (job.client.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
        }

        // If budgetMax is being updated, validate wallet balance
        if (req.body.budgetMax !== undefined) {
            const newBudgetMax = parseFloat(req.body.budgetMax);
            const oldBudgetMax = job.budgetMax;

            // Get current client wallet
            const User = require('../models/User');
            const client = await User.findById(req.user._id);

            if (!client) {
                return res.status(404).json({ success: false, message: 'Client not found' });
            }

            // Check if there's an accepted proposal (order in progress)
            const Proposal = require('../models/index').Proposal;
            const acceptedProposal = await Proposal.findOne({
                job: req.params.id,
                status: 'accepted'
            });

            let requiredBalance = newBudgetMax;

            // If there's already a payment held in escrow, calculate the difference
            if (acceptedProposal) {
                const oldEscrowAmount = oldBudgetMax;
                const newEscrowAmount = newBudgetMax;
                const difference = newEscrowAmount - oldEscrowAmount;

                requiredBalance = difference; // Only need the difference
            }

            // Check wallet balance
            if (client.walletBalance < requiredBalance) {
                const shortfall = requiredBalance - client.walletBalance;
                const error = new Error(
                    `Insufficient wallet balance. Need $${requiredBalance}, Have $${client.walletBalance}, Shortfall: $${shortfall}`
                );
                error.code = 'INSUFFICIENT_BALANCE';
                error.statusCode = 400;
                error.required = requiredBalance;
                error.available = client.walletBalance;
                error.shortfall = shortfall;
                return res.status(400).json({ success: false, message: error.message });
            }
        }

        // Update the job
        const updated = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.json({ success: true, job: updated });
    } catch (err) { next(err); }
};

exports.deleteJob = async (req, res, next) => {
    try {
        await Job.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Job deleted' });
    } catch (err) { next(err); }
};

exports.getMyJobs = async (req, res, next) => {
    try {
        const jobs = await Job.find({ client: req.user._id }).sort('-createdAt').lean({ defaults: true });
        res.json({ success: true, jobs });
    } catch (err) { next(err); }
};

exports.getFreelancersForJob = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
        const freelancers = await User.find({
            skills: { $in: job.skills },
            role: 'freelancer',
        }).select('fullName profileImage aiSkillScore');
        res.json({ success: true, freelancers });
    } catch (err) { next(err); }
};


// Add this at the very end of controllers/jobController.js
module.exports = {
    createJob: exports.createJob,
    getJobs: exports.getJobs,
    getJob: exports.getJob,
    updateJob: exports.updateJob,
    deleteJob: exports.deleteJob,
    getMyJobs: exports.getMyJobs,
    getFreelancersForJob: exports.getFreelancersForJob   // optional
};
