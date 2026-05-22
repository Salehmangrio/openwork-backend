/**
 * aiService.js - Updated for openwork-ai-service integration
 * Matches openwork-ai-service API format
 * 
 * TIMEOUT FIX (May 22, 2026):
 * - Timeout increased: 30s → 150s (supports HuggingFace cold starts)
 * - Added axios-retry with exponential backoff
 * - Enhanced error logging with request IDs
 * - Graceful fallback responses (no crashes)
 */

const axios = require('axios');
const axiosRetry = require('axios-retry');
const { User, Job } = require('../models/index');

// Configuration from environment or defaults
const AI_URL = process.env.PYTHON_AI_SERVICE_URL;

// Parse timeout with robust validation
let AI_TIMEOUT_MS = 150000; // Default: 150 seconds
const RAW_TIMEOUT = process.env.AI_SERVICE_TIMEOUT;
if (RAW_TIMEOUT) {
  const parsed = parseInt(RAW_TIMEOUT, 10);
  if (!isNaN(parsed) && parsed >= 1000) {
    AI_TIMEOUT_MS = parsed;
  } else {
    console.warn(`⚠️  Invalid AI_SERVICE_TIMEOUT="${RAW_TIMEOUT}", using default 150000ms`);
  }
}

const MAX_RETRIES = parseInt(process.env.AI_SERVICE_MAX_RETRIES || '3', 10);

// ✅ Log configuration on startup
console.log('🚀 AI Service Configuration at startup:');
console.log(`   AI_URL: ${AI_URL || '❌ NOT SET - using fallbacks'}`);
console.log(`   Timeout: ${AI_TIMEOUT_MS}ms (${(AI_TIMEOUT_MS / 1000).toFixed(1)}s)`);
console.log(`   Max Retries: ${MAX_RETRIES}`);
if (RAW_TIMEOUT) {
  console.log(`   (Read from env: AI_SERVICE_TIMEOUT=${RAW_TIMEOUT})`);
}

// Create axios client with retry logic
const aiClient = axios.create({
  baseURL: AI_URL || 'http://localhost:8000',
  timeout: AI_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// Add retry logic with exponential backoff
axiosRetry(aiClient, {
  retries: MAX_RETRIES,
  retryDelay: (retryCount) => {
    // Exponential backoff: 1s, 2s, 4s
    return retryCount * 1000 * Math.pow(2, retryCount - 1);
  },
  retryCondition: (error) => {
    // Retry on network errors (no response received)
    if (!error.response) return true;
    
    // Retry on server errors (5xx)
    if (error.response.status >= 500) return true;
    
    // Don't retry client errors (4xx)
    if (error.response.status >= 400 && error.response.status < 500) return false;
    
    // Retry on timeout
    if (error.code === 'ECONNABORTED') return true;
    
    return false;
  },
});

// Graceful fallback responses for when AI service is unavailable
const FALLBACK_RESPONSES = {
  chat: {
    message: 'I\'m currently unavailable. Please try again in a moment.',
    fallback: true,
  },
  proposal: {
    proposal: 'I\'m confident I can deliver excellent results for this project based on my skills and experience. Please contact me to discuss details.',
    fallback: true,
  },
  jobMatch: {
    matchScore: 65,
    breakdown: {
      skillMatch: 70,
      experienceMatch: 60,
      locationMatch: 65,
    },
    recommendation: 'Consider applying - you have relevant skills for this role.',
    fallback: true,
  },
  skillSuggestions: {
    suggestions: ['Communication', 'Problem Solving', 'Time Management', 'Attention to Detail'],
    fallback: true,
  },
  skillTest: {
    questions: [
      { question: 'Service temporarily unavailable', difficulty: 'easy', type: 'multiple_choice' }
    ],
    fallback: true,
  },
  fraud: {
    fraudProbability: 0.1,
    flags: [],
    fallback: true,
  },
};

async function callAIService(endpoint, payload, method = 'POST') {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`📡 [${requestId}] AI Request: ${method} ${endpoint}`);
    console.log(`   Calling: ${AI_URL || 'FALLBACK MODE'} (timeout: ${AI_TIMEOUT_MS}ms)`);
    
    // If AI_URL is not configured, throw error to trigger fallback
    if (!AI_URL) {
      throw new Error('AI_SERVICE_URL not configured - using fallback response');
    }
    
    let response;
    if (method === 'POST') {
      response = await aiClient.post(endpoint, payload);
    } else if (method === 'GET') {
      response = await aiClient.get(endpoint);
    } else {
      throw new Error(`Unsupported HTTP method: ${method}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ [${requestId}] Success (${duration}ms)`);
    
    return response.data;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log error details with timeout info
    console.error(`❌ [${requestId}] Failed after ${duration}ms (timeout: ${AI_TIMEOUT_MS}ms)`);
    console.error(`   Endpoint: ${endpoint}`);
    console.error(`   Error: ${error.code || error.name} - ${error.message}`);
    
    if (error.response) {
      console.error(`   HTTP Status: ${error.response.status}`);
    } else if (error.request) {
      console.error(`   No response received - possible network/timeout issue`);
    }
    
    // Categorize error for better messaging
    if (error.code === 'ECONNABORTED') {
      throw new Error(`Request timed out after ${duration}ms (configured timeout: ${AI_TIMEOUT_MS}ms). AI service may be slow.`);
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to AI service. Service may be down.`);
    } else if (error.code === 'ENOTFOUND') {
      throw new Error(`AI service hostname not found: ${AI_URL}`);
    } else if (error.response?.status >= 500) {
      throw new Error(`AI service error (${error.response.status}): Server error`);
    } else if (error.response?.status >= 400) {
      throw new Error(`Invalid request (${error.response.status}): ${error.response.data?.detail || error.message}`);
    }
    
    throw error;
  }
}

exports.generateProposal = async (freelancerId, jobId) => {
  try {
    const [freelancer, job] = await Promise.all([
      User.findById(freelancerId).select('fullName skills experienceLevel aiSkillScore averageRating completedJobs'),
      Job.findById(jobId).select('title description skills budgetMin budgetMax'),
    ]);
    if (!freelancer || !job) throw new Error('Freelancer or job not found');

    const result = await callAIService('/ai/generate-proposal', {
      jobDescription: job.description,
      freelancerProfile: {
        fullName: freelancer.fullName,
        skills: freelancer.skills || [],
        experienceLevel: freelancer.experienceLevel,
        aiScore: freelancer.aiSkillScore || 0,
        rating: freelancer.averageRating || 0,
        completedJobs: freelancer.completedJobs || 0,
      },
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
  } catch (error) {
    console.warn(`⚠️  Using fallback for proposal generation: ${error.message}`);
    return {
      success: true,
      proposal: {
        generatedText: FALLBACK_RESPONSES.proposal.proposal,
        freelancer: freelancerId,
        job: jobId,
        isAIGenerated: false,
        isAIFallback: true,
        generatedAt: new Date(),
        fallbackReason: error.message,
      },
    };
  }
};

exports.calculateJobMatch = async (freelancerId, jobId) => {
  try {
    const [freelancer, job] = await Promise.all([
      User.findById(freelancerId).select('skills experienceLevel averageRating aiSkillScore completedJobs location responseTimeHours'),
      Job.findById(jobId).select('title description skills experienceLevel category location'),
    ]);
    if (!freelancer || !job) throw new Error('Freelancer or job not found');

    const result = await callAIService('/ai/job-match', {
      freelancer: {
        skills: freelancer.skills || [],
        aiScore: freelancer.aiSkillScore || 0,
        experience: freelancer.experienceLevel,
        location: freelancer.location || '',
        completedJobs: freelancer.completedJobs || 0,
        rating: freelancer.averageRating || 0,
        responseTimeHours: freelancer.responseTimeHours || 24,
      },
      jobs: [{
        id: job._id.toString(),
        title: job.title,
        skills: job.skills || [],
        experienceLevel: job.experienceLevel,
        location: job.location || '',
      }],
    });

    const match = result.results?.[0] || {};
    return {
      success: true,
      matchScore: match.matchScore ?? 0,
      breakdown: match.breakdown || {},
      recommendation: match.recommendation || 'Match calculated',
    };
  } catch (error) {
    console.warn(`⚠️  Using fallback for job matching: ${error.message}`);
    return {
      success: true,
      matchScore: FALLBACK_RESPONSES.jobMatch.matchScore,
      breakdown: FALLBACK_RESPONSES.jobMatch.breakdown,
      recommendation: FALLBACK_RESPONSES.jobMatch.recommendation,
      isAIFallback: true,
      fallbackReason: error.message,
    };
  }
};

exports.getJobRecommendations = async (freelancerId, limit = 10) => {
  try {
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
        } catch (err) { 
          console.warn(`Warning: Failed to calculate match for job ${job._id}: ${err.message}`);
          return { job: job.toObject(), matchScore: 0, isAIFallback: true }; 
        }
      })
    );

    recommendations.sort((a, b) => b.matchScore - a.matchScore);
    return { success: true, recommendations: recommendations.slice(0, limit), isAIFallback: false };
  } catch (error) {
    console.warn(`⚠️  Using fallback for job recommendations: ${error.message}`);
    return { 
      success: true, 
      recommendations: [], 
      isAIFallback: true,
      fallbackReason: error.message,
    };
  }
};

exports.chat = async (messages, context = {}) => {
  try {
    const result = await callAIService('/ai/chat', {
      messages: messages || [{ role: 'user', content: 'Hello' }],
    });
    return { 
      success: true, 
      message: result.message || 'No response', 
      model: result.model || 'OpenRouter-Free',
      isAIFallback: false,
    };
  } catch (error) {
    console.warn(`⚠️  Using fallback for chat: ${error.message}`);
    return { 
      success: true, 
      message: FALLBACK_RESPONSES.chat.message, 
      model: 'Fallback-Response',
      isAIFallback: true,
      fallbackReason: error.message,
    };
  }
};

exports.analyzeProfile = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const result = await callAIService('/ai/chat', {
      messages: [
        { role: 'system', content: 'You are a professional career coach for freelancers.' },
        { role: 'user', content: `Analyze this profile and provide actionable tips: Skills: ${user.skills?.join(', ')}, Experience: ${user.experienceLevel}, AI Score: ${user.aiSkillScore || 0}/100, Rating: ${user.averageRating || 0}/5` }
      ],
    });
    return { success: true, analysis: result.message || 'Unable to analyze profile', isAIFallback: false };
  } catch (error) {
    console.warn(`⚠️  Using fallback for profile analysis: ${error.message}`);
    return { 
      success: true, 
      analysis: 'Your profile looks great! Keep working on developing your skills and maintaining a strong reputation.',
      isAIFallback: true,
      fallbackReason: error.message,
    };
  }
};

exports.getLearningRecommendations = async (userId, targetSkills = []) => {
  try {
    const user = await User.findById(userId).select('skills experienceLevel');
    if (!user) throw new Error('User not found');

    const result = await callAIService('/ai/skill-suggestions', {
      category: targetSkills.length > 0 ? targetSkills[0] : 'general',
      query: targetSkills.length > 0 ? targetSkills.join(', ') : '',
    });
    return { success: true, recommendations: result.suggestions || [], isAIFallback: false };
  } catch (error) {
    console.warn(`⚠️  Using fallback for learning recommendations: ${error.message}`);
    return { 
      success: true, 
      recommendations: FALLBACK_RESPONSES.skillSuggestions.suggestions,
      isAIFallback: true,
      fallbackReason: error.message,
    };
  }
};

exports.generateSkillTest = async (topic, level = 'easy') => {
  try {
    if (!topic) throw new Error('Topic is required');

    const result = await callAIService('/ai/skill-test/generate', {
      topic: topic.toLowerCase().trim(),
      level: level.toLowerCase() || 'easy',
      total: 15,
    });

    return {
      success: true,
      topic: result.topic || topic,
      level: result.level || level,
      questions: result.questions || [],
      total: result.total || 0,
      isAIFallback: false,
    };
  } catch (error) {
    console.warn(`⚠️  Using fallback for skill test generation: ${error.message}`);
    return {
      success: true,
      topic: topic,
      level: level,
      questions: FALLBACK_RESPONSES.skillTest.questions,
      total: 1,
      isAIFallback: true,
      fallbackReason: error.message,
    };
  }
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

  // MCQ SCORING
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
      score: correct,
      total,
      percentage,
      feedback: passed
        ? "Great job! You passed the test."
        : "Keep practicing to improve your score.",
      results
    }
  };
};

exports.detectFraud = async (loginPatterns = [], bidAmounts = [], responseTimes = []) => {
  try {
    if (!loginPatterns.length || !bidAmounts.length || !responseTimes.length) {
      return { success: true, fraudProbability: 0.0, flags: [], isAIFallback: false };
    }

    const result = await callAIService('/ai/fraud-detect', {
      loginPatterns: loginPatterns,
      bidAmounts: bidAmounts,
      responseTimes: responseTimes,
    });

    return {
      success: true,
      fraudProbability: result.fraudProbability ?? 0,
      flags: result.flags || [],
      risk: result.fraudProbability > 0.6 ? 'high' : result.fraudProbability > 0.3 ? 'medium' : 'low',
      isAIFallback: false,
    };
  } catch (error) {
    console.warn(`⚠️  Using fallback for fraud detection: ${error.message}`);
    return {
      success: true,
      fraudProbability: FALLBACK_RESPONSES.fraud.fraudProbability,
      flags: FALLBACK_RESPONSES.fraud.flags,
      risk: 'low',
      isAIFallback: true,
      fallbackReason: error.message,
    };
  }
};

exports.getSkillSuggestions = async (category = '', query = '') => {
  try {
    const result = await callAIService('/ai/skill-suggestions', {
      category: category || 'general',
      query: query || '',
    });

    return {
      success: true,
      suggestions: result.suggestions || [],
      total: (result.suggestions || []).length,
      isAIFallback: false,
    };
  } catch (error) {
    console.warn(`⚠️  Using fallback for skill suggestions: ${error.message}`);
    return {
      success: true,
      suggestions: FALLBACK_RESPONSES.skillSuggestions.suggestions,
      total: FALLBACK_RESPONSES.skillSuggestions.suggestions.length,
      isAIFallback: true,
      fallbackReason: error.message,
    };
  }
};

exports.moderate = async (message) => {
  try {
    if (!message) throw new Error('Message is required');

    const result = await callAIService('/ai/moderate', {
      message: message,
    });

    return {
      success: true,
      verdict: result.verdict || 'SAFE',
      reason: result.reason || '',
      isAIFallback: false,
    };
  } catch (error) {
    console.warn(`⚠️  Using fallback for moderation: ${error.message}`);
    return {
      success: true,
      verdict: 'SAFE',
      reason: 'Moderation unavailable - allowing message',
      isAIFallback: true,
      fallbackReason: error.message,
    };
  }
};

exports.health = async () => {
  try {
    const result = await callAIService('/ai/health', {}, 'GET');
    return { success: true, message: result.message, isAIFallback: false };
  } catch (error) {
    console.warn(`⚠️  AI health check failed: ${error.message}`);
    return { 
      success: false, 
      message: `AI service unreachable: ${error.message}`,
      isAIFallback: true,
    };
  }
};