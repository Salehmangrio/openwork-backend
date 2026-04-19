const axios = require('axios');

// Configuration for Message Detection AI
const AI_SERVICE_URL = process.env.MESSAGE_AI_URL || 'http://localhost:7860';

/**
 * Call the message detection AI service to analyze message content
 * @param {string} messageContent - The message text to analyze
 * @returns {Promise<{status: string, score: number}>} - Safe/Unsafe status and confidence score
 */
const analyzeMessageContent = async (messageContent) => {
  try {
    // Skip analysis for empty or very short messages
    if (!messageContent || messageContent.trim().length < 3) {
      return {
        status: 'safe',
        score: 0,
      };
    }

    const response = await axios.post(
      `${AI_SERVICE_URL}/predict`,
      { text: messageContent.trim() },
      { timeout: 10000 } // 10 second timeout
    );

    const { prediction, score } = response.data;

    return {
      status: prediction.includes('Safe') ? 'safe' : 'unsafe',
      score: score || 0,
    };
  } catch (error) {
    console.error('Error analyzing message content:', error.message);

    // Fallback: Mark as pending if AI service is unavailable
    return {
      status: 'pending',
      score: 0,
    };
  }
};

/**
 * Analyze batch of messages
 * @param {Array} messages - Array of message texts
 * @returns {Promise<Array>} - Array of analysis results
 */
const analyzeMessageBatch = async (messages) => {
  try {
    const promises = messages.map(msg => analyzeMessageContent(msg));
    return await Promise.all(promises);
  } catch (error) {
    console.error('Error in batch analysis:', error.message);
    return messages.map(() => ({ status: 'pending', score: 0 }));
  }
};

module.exports = {
  analyzeMessageContent,
  analyzeMessageBatch,
};
