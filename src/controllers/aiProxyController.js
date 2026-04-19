const User = require('../models/User');
const Job = require('../models/Job');

const PY_AI_BASE = (process.env.PYTHON_AI_SERVICE_URL || 'https://salehmangrio114-openwork.hf.space').replace(/\/$/, '');

const callPythonAI = async (path, method = 'POST', body) => {
  const fullUrl = `${PY_AI_BASE}${path}`;
  console.log(`[AI Proxy] ${method} ${fullUrl}`);
  const response = await fetch(fullUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Python AI service error (${response.status}): ${errText}`);
  }
  return response.json();
};

exports.chat = async (req, res, next) => {
  try {
    const payload = {
      messages: req.body.messages || [],
    };
    const data = await callPythonAI('/ai/chat', 'POST', payload);
    res.json({ success: true, message: data.message });
  } catch (err) {
    next(err);
  }
};

exports.generateProposal = async (req, res, next) => {
  try {
    const data = await callPythonAI('/ai/generate-proposal', 'POST', {
      jobDescription: req.body.jobDescription,
      freelancerProfile: req.body.freelancerProfile,
    });
    res.json({ success: true, proposal: data.proposal });
  } catch (err) {
    next(err);
  }
};

exports.jobMatch = async (req, res, next) => {
  try {
    const { jobs } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const freelancer = {
      skills: user.skills || [],
      aiScore: user.aiSkillScore || 0,
      experience: user.experienceLevel || 'mid',
      location: user.location || '',
      completedJobs: user.completedJobs || 0,
      rating: user.averageRating || 0,
      responseTimeHours: user.responseTime || 24,
    };

    let jobsToMatch = jobs;
    if (!Array.isArray(jobsToMatch) || jobsToMatch.length === 0) {
      const openJobs = await Job.find({ status: 'open' }).select('title skills experienceLevel location category budgetMin budgetMax');
      jobsToMatch = openJobs.map((j) => ({
        id: j._id.toString(),
        title: j.title,
        skills: j.skills,
        experienceLevel: j.experienceLevel,
        location: j.location || '',
        category: j.category,
        budgetMin: j.budgetMin,
        budgetMax: j.budgetMax,
      }));
    }

    const data = await callPythonAI('/ai/job-match', 'POST', {
      freelancer,
      jobs: jobsToMatch,
    });

    res.json({ success: true, results: data.results || [] });
  } catch (err) {
    next(err);
  }
};

exports.getRecommendations = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId).select('skills aiSkillScore experienceLevel location completedJobs averageRating responseTime');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const openJobs = await Job.find({ status: 'open' }).limit(30).select('title skills experienceLevel location category budgetMin budgetMax');

    const data = await callPythonAI('/ai/job-match', 'POST', {
      freelancer: {
        skills: user.skills || [],
        aiScore: user.aiSkillScore || 0,
        experience: user.experienceLevel || 'mid',
        location: user.location || '',
        completedJobs: user.completedJobs || 0,
        rating: user.averageRating || 0,
        responseTimeHours: user.responseTime || 24,
      },
      jobs: openJobs.map((j) => ({
        id: j._id.toString(),
        title: j.title,
        skills: j.skills,
        experienceLevel: j.experienceLevel,
        location: j.location || '',
        category: j.category,
        budgetMin: j.budgetMin,
        budgetMax: j.budgetMax,
      })),
    });

    res.json({ success: true, userId, recommendations: (data.results || []).slice(0, 10) });
  } catch (err) {
    next(err);
  }
};

exports.getJobMatch = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const user = await User.findById(req.user._id).select('skills aiSkillScore experienceLevel location completedJobs averageRating responseTime');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const job = await Job.findById(jobId).select('title skills experienceLevel location category budgetMin budgetMax').lean();
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const freelancer = {
      skills: user.skills || [],
      aiScore: user.aiSkillScore || 0,
      experience: user.experienceLevel || 'mid',
      location: user.location || '',
      completedJobs: user.completedJobs || 0,
      rating: user.averageRating || 0,
      responseTimeHours: user.responseTime || 24,
    };

    const jobsPayload = [{
      id: job._id.toString(),
      title: job.title,
      skills: job.skills,
      experienceLevel: job.experienceLevel,
      location: job.location || '',
      category: job.category,
      budgetMin: job.budgetMin,
      budgetMax: job.budgetMax,
    }];

    const data = await callPythonAI('/ai/job-match', 'POST', { freelancer, jobs: jobsPayload });
    const match = data.results?.[0] || { matchScore: 0, breakdown: {} };

    res.json({ success: true, ...match });
  } catch (err) {
    next(err);
  }
};
