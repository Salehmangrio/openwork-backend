/**
 * skillTestService.js
 * Skill testing and certification management
 * Integrates with Python AI service for test generation and evaluation
 */

const { User } = require('../models/index');
const { logActivity, sendNotification } = require('../utils/helpers');

const PYTHON_SERVICE_URL = process.env.PYTHON_SKILL_TESTING_SERVICE_URL;

/**
 * Generate skill test questions from Python AI service
 * @param {String} topic - Skill topic
 * @param {String} level - Difficulty level (easy, medium, hard)
 * @returns {Object} Generated test questions
 */
exports.generateSkillTest = async (topic, level = 'easy') => {
  try {
    if (!topic) {
      throw new Error('Topic is required');
    }

    if (!PYTHON_SERVICE_URL) {
      console.warn('⚠️ PYTHON_SKILL_TESTING_SERVICE_URL not configured');
      throw new Error('AI service currently unavailable');
    }

    console.log(`🔍 Calling Python service: ${PYTHON_SERVICE_URL}/ai/skill-test/generate`);

    const response = await fetch(`${PYTHON_SERVICE_URL}/ai/skill-test/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topic.trim(),
        level: level.toLowerCase(),
        total: 5,
      }),
      timeout: 30000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Python service error: ${response.status} - ${errorText}`);
      throw new Error(`Python service error: ${response.status}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data.questions || !Array.isArray(data.questions)) {
      throw new Error('Invalid response structure from Python service');
    }

    return {
      success: true,
      topic: data.topic || topic,
      level: data.level || level,
      questions: data.questions,
    };
  } catch (error) {
    console.error('❌ Generate skill test error:', error.message);
    throw new Error(`Failed to generate test: ${error.message}`);
  }
};

/**
 * Evaluate skill test answers locally - no external service calls
 * @param {ObjectId} userId - User ID
 * @param {String} topic - Skill topic
 * @param {Array} questions - Test questions with user answers
 * @param {String} ip - User IP address
 * @returns {Object} Evaluation result
 */
exports.evaluateSkillTest = async (userId, topic, questions, ip) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!topic || !questions || !Array.isArray(questions)) {
      throw new Error('Missing required fields: topic and questions array');
    }

    // Local evaluation - compare user answers with correct answers
    let correct = 0;
    questions.forEach((q) => {
      if (q.user_answer === q.correct_answer) {
        correct++;
      }
    });

    const total = questions.length;
    const percentage = Math.round((correct / total) * 100);
    const score = correct;
    const feedback = `You scored ${score}/${total}`;
    const results = questions.map((q) => ({
      question: q.question,
      correct: q.correct_answer,
      user: q.user_answer,
      isCorrect: q.user_answer === q.correct_answer,
    }));

    const passed = percentage >= 60;

    // Save certification to user
    const cert = {
      skill: topic,
      score,
      total,
      pct: Math.round(percentage),
      passed,
      takenAt: new Date(),
    };

    const existingIdx = user.certifications.findIndex(c => c.skill === topic);
    if (existingIdx >= 0) {
      user.certifications[existingIdx] = cert;
    } else {
      user.certifications.push(cert);
    }

    // Update AI score if passed
    if (passed) {
      const scoreIncrease = Math.round(percentage / 10);
      user.aiSkillScore = Math.min(100, (user.aiSkillScore || 0) + scoreIncrease);
      user.skillScoreHistory = user.skillScoreHistory || [];
      user.skillScoreHistory.push({ score: user.aiSkillScore, updatedAt: new Date() });

      if (user.recalcAIRank) user.recalcAIRank();

      await sendNotification(user._id, {
        type: 'skill_test_passed',
        title: `🏆 Certified in ${topic}!`,
        message: `You scored ${score}/${total}. AI score +${scoreIncrease} points!`,
        link: '/profile/certifications',
        category: 'system',
      });
    }

    await user.save({ validateBeforeSave: false });
    await logActivity(user._id, 'skill_test', 'User', user._id, `${topic}: ${score}/${total}`, ip, false);

    return {
      success: true,
      result: {
        passed,
        score,
        total,
        percentage: Math.round(percentage),
        feedback,
        results,
        aiScoreIncrease: passed ? Math.round(percentage / 10) : 0,
        aiScore: user.aiSkillScore,
      },
    };
  } catch (error) {
    console.error('Evaluate skill test error:', error);
    throw new Error(`Failed to evaluate test: ${error.message}`);
  }
};

/**
 * Submit and evaluate skill test locally (legacy endpoint)
 * @param {ObjectId} userId - User ID
 * @param {String} skill - Skill name
 * @param {Array} answers - User answers
 * @param {Array} questions - Questions with correct answers
 * @param {String} ip - User IP address
 * @returns {Object} Test result
 */
exports.submitSkillTest = async (userId, skill, answers, questions, ip) => {
  try {
    if (!skill || !answers || !questions) {
      throw new Error('Missing required fields');
    }

    let correct = 0;
    answers.forEach((ans, i) => {
      if (ans === questions[i].correctAnswer) {
        correct++;
      }
    });

    const total = questions.length;
    const pct = Math.round((correct / total) * 100);
    const passed = correct >= Math.ceil(total * 0.6);

    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Add certification
    const cert = { skill, score: correct, total, pct, passed, takenAt: new Date() };
    const existingIdx = user.certifications.findIndex(c => c.skill === skill);
    if (existingIdx >= 0) {
      user.certifications[existingIdx] = cert;
    } else {
      user.certifications.push(cert);
    }

    // Update AI score if passed
    if (passed) {
      const scoreIncrease = Math.round(pct / 10);
      user.aiSkillScore = Math.min(100, (user.aiSkillScore || 0) + scoreIncrease);
      user.skillScoreHistory = user.skillScoreHistory || [];
      user.skillScoreHistory.push({ score: user.aiSkillScore, updatedAt: new Date() });

      if (user.recalcAIRank) {
        user.recalcAIRank();
      }

      await sendNotification(user._id, {
        type: 'skill_test_passed',
        title: `🏆 Certified in ${skill}!`,
        message: `You scored ${correct}/${total}. AI score +${scoreIncrease} points!`,
        link: '/profile/certifications',
        category: 'system',
      });
    }

    await user.save({ validateBeforeSave: false });
    await logActivity(user._id, 'skill_test', 'User', user._id, `${skill}: ${correct}/${total}`, ip, false);

    return {
      success: true,
      result: {
        passed,
        score: correct,
        total,
        pct,
        aiScore: user.aiSkillScore,
        aiScoreIncrease: passed ? Math.round(pct / 10) : 0,
      },
    };
  } catch (error) {
    throw new Error(`Failed to submit test: ${error.message}`);
  }
};

/**
 * Get user certifications
 * @param {ObjectId} userId - User ID
 * @returns {Object} Certifications and AI score
 */
exports.getCertifications = async (userId) => {
  try {
    const user = await User.findById(userId).select('certifications aiSkillScore skillScoreHistory');

    if (!user) {
      throw new Error('User not found');
    }

    return {
      success: true,
      certifications: user.certifications,
      aiSkillScore: user.aiSkillScore,
      history: user.skillScoreHistory,
    };
  } catch (error) {
    throw new Error(`Failed to fetch certifications: ${error.message}`);
  }
};
