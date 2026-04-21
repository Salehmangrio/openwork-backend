/**
 * aiService.js - Fixed version
 * Bug Fix #8: this.calculateJobMatch → exports.calculateJobMatch
 * Bug Fix #9: fetch timeout via AbortController
 * Bug Fix #10: URL normalisation centralised
 */

const { User, Job } = require('../models/index');

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callPythonAI(endpoint, payload) {
  const aiUrl = process.env.PYTHON_AI_SERVICE_URL;
  if (!aiUrl) throw new Error('PYTHON_AI_SERVICE_URL not configured in .env');

  const url = `${aiUrl.replace(/\/$/, '')}${endpoint}`;
  console.log(`🔗 Calling Python AI: ${url}`);

  let response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, 30000);
  } catch (fetchErr) {
    if (fetchErr.name === 'AbortError') throw new Error('AI service timed out after 30s');
    throw new Error(`AI service unreachable: ${fetchErr.message}`);
  }

  let data;
  try { data = await response.json(); }
  catch { throw new Error('AI service returned non-JSON response'); }

  if (!response.ok) {
    let msg;
    if (Array.isArray(data)) {
      // Handle FastAPI validation errors (array of error objects)
      msg = data.map(err =>
        err.msg || err.message || err.detail || JSON.stringify(err)
      ).join('; ');
    } else {
      msg = data?.detail || data?.error || data?.message || JSON.stringify(data);
    }
    throw new Error(`AI service error (${response.status}): ${msg}`);
  }
  return data;
}

exports.generateProposal = async (freelancerId, jobId) => {
  const [freelancer, job] = await Promise.all([
    User.findById(freelancerId).select('fullName skills experienceLevel aiSkillScore'),
    Job.findById(jobId).select('title description skills budgetMin budgetMax'),
  ]);
  if (!freelancer || !job) throw new Error('Freelancer or job not found');

  const result = await callPythonAI('/ai/generate-proposal', {
    job_title: job.title,
    job_description: job.description,
    required_skills: job.skills || [],
    budget: { min: job.budgetMin, max: job.budgetMax },
    freelancer_name: freelancer.fullName,
    freelancer_skills: freelancer.skills || [],
    freelancer_experience: freelancer.experienceLevel,
    freelancer_ai_score: freelancer.aiSkillScore || 0,
  });

  return {
    success: true,
    proposal: {
      generatedText: result.proposal || '',
      freelancer: freelancer._id,
      job: job._id,
      isAIGenerated: true,
      generatedAt: new Date(),
    },
  };
};

exports.calculateJobMatch = async (freelancerId, jobId) => {
  const [freelancer, job] = await Promise.all([
    User.findById(freelancerId).select('skills experienceLevel averageRating aiSkillScore'),
    Job.findById(jobId).select('skills experienceLevel category'),
  ]);
  if (!freelancer || !job) throw new Error('Freelancer or job not found');

  const result = await callPythonAI('/ai/job-match', {
    freelancer: {
      skills: freelancer.skills || [],
      experience: freelancer.experienceLevel,
      rating: freelancer.averageRating || 0,
      aiScore: freelancer.aiSkillScore || 0,
    },
    jobs: [{
      id: job._id.toString(),
      skills: job.skills || [],
      experienceLevel: job.experienceLevel,
      category: job.category,
    }],
  });

  const match = result.results?.[0] || {};
  return {
    success: true,
    matchScore: match.matchScore ?? 0,
    breakdown: match.breakdown || {},
    recommendation: match.recommendation || 'Match calculated',
  };
};

// Bug Fix #8: was `this.calculateJobMatch` - undefined in module scope
exports.getJobRecommendations = async (freelancerId, limit = 10) => {
  const freelancer = await User.findById(freelancerId).select('skills experienceLevel');
  if (!freelancer) throw new Error('Freelancer not found');

  const jobs = await Job.find({
    $or: [{ skills: { $in: freelancer.skills } }, { experienceLevel: freelancer.experienceLevel }],
    status: 'open',
  }).sort('-createdAt').limit(limit * 2)
    .select('_id title category skills experienceLevel budgetMin budgetMax');

  const recommendations = await Promise.all(
    jobs.map(async (job) => {
      try {
        const match = await exports.calculateJobMatch(freelancerId, job._id);
        return { job: job.toObject(), ...match };
      } catch { return { job: job.toObject(), matchScore: 0 }; }
    })
  );

  recommendations.sort((a, b) => b.matchScore - a.matchScore);
  return { success: true, recommendations: recommendations.slice(0, limit) };
};

exports.chat = async (messages, context = {}) => {
  const result = await callPythonAI('/ai/chat', {
    messages: messages || [{ role: 'user', content: 'Hello' }],
    user_role: context.userRole || 'user',
    user_context: context.userContext || '',
  });
  return { success: true, message: result.message || 'No response', model: result.model || 'OpenRouter-Free' };
};

exports.analyzeProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const result = await callPythonAI('/ai/chat', {
    messages: [
      { role: 'system', content: 'You are a professional career coach for freelancers.' },
      { role: 'user', content: `Analyze this profile and provide actionable tips: Skills: ${user.skills?.join(', ')}, Experience: ${user.experienceLevel}, AI Score: ${user.aiSkillScore || 0}/100, Rating: ${user.averageRating || 0}/5` }
    ],
    user_role: 'freelancer',
    user_context: 'Profile analysis',
  });
  return { success: true, analysis: result.message || 'Unable to analyze profile' };
};

exports.getLearningRecommendations = async (userId, targetSkills = []) => {
  const user = await User.findById(userId).select('skills experienceLevel');
  if (!user) throw new Error('User not found');

  const result = await callPythonAI('/ai/skill-suggestions', {
    current_skills: user.skills || [],
    target_skills: targetSkills.length > 0 ? targetSkills : ['TypeScript', 'Next.js'],
    experience_level: user.experienceLevel,
    platform: 'OpenWork',
  });
  return { success: true, recommendations: result.suggestions || [] };
};

exports.generateSkillTest = async (topic, level = 'easy') => {
  if (!topic) throw new Error('Topic is required');

  const result = await callPythonAI('/ai/skill-test/generate', {
    topic: topic.toLowerCase().trim(),
    level: level.toLowerCase() || 'easy',
    total: 5,
  });

  return {
    success: true,
    topic: result.topic || topic,
    level: result.level || level,
    questions: result.questions || [],
    total: result.total || 0,
  };
};

exports.evaluateSkillTest = async (userId, topic, questions) => {
  if (!topic || !questions || !Array.isArray(questions)) {
    throw new Error('Topic and questions array are required');
  }

  const transformedQuestions = questions.map(q =>
    typeof q === 'string' ? q : q.question
  );

  const answers = questions.map(q =>
    typeof q === 'string' ? '' : (q.user_answer || '')
  );

  let correct = 0;
  const results = [];

  // ====================== SIMPLE MCQ SCORING ======================
  transformedQuestions.forEach((q, index) => {
    const answer = (answers[index] || "").trim();
    const correctAnswer =
      typeof questions[index] === 'string'
        ? ''
        : (questions[index].correct_answer || "").trim();

    const isCorrect =
      answer.toLowerCase() === correctAnswer.toLowerCase();

    if (isCorrect) correct++;

    results.push({
      question: q,
      answer: answer,
      correctAnswer: correctAnswer,
      score: isCorrect ? 1 : 0
    });
  });

  const total = transformedQuestions.length;

  const percentage = Math.round((correct / total) * 100);
  const passed = percentage >= 60;

  return {
    success: true,
    result: {
      passed,
      score: correct,        // ✅ number of correct answers
      total,                 // total questions
      percentage,           // optional (for UI only)
      feedback: passed
        ? "Great job! You passed the test."
        : "Keep practicing to improve your score.",
      results
    }
  };
};

exports.detectFraud = async (loginPatterns = [], bidAmounts = [], responseTimes = []) => {
  if (!loginPatterns.length || !bidAmounts.length || !responseTimes.length) {
    return { success: true, fraudProbability: 0.0, flags: [] };
  }

  const result = await callPythonAI('/ai/fraud-detect', {
    loginPatterns: loginPatterns,
    bidAmounts: bidAmounts,
    responseTimes: responseTimes,
  });

  return {
    success: true,
    fraudProbability: result.fraudProbability ?? 0,
    flags: result.flags || [],
    risk: result.fraudProbability > 0.6 ? 'high' : result.fraudProbability > 0.3 ? 'medium' : 'low',
  };
};

exports.getSkillSuggestions = async (category = '', query = '') => {
  const result = await callPythonAI('/ai/skill-suggestions', {
    category: category || 'general',
    query: query || '',
  });

  return {
    success: true,
    suggestions: result.suggestions || [],
    total: (result.suggestions || []).length,
  };
};
