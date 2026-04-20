const axios = require('axios');

// Configuration for Message Detection AI
const AI_SERVICE_URL = process.env.MESSAGE_DETECTOR_URL || process.env.MESSAGE_AI_URL || 'http://localhost:7860';

/**
 * Call the message detection AI service to analyze message content
 * @param {string} messageContent - The message text to analyze
 * @returns {Promise<{status: string, score: number}>} - Safe/Unsafe status and confidence score
 */
const analyzeMessageContent = async (messageContent) => {
    try {
        // Skip analysis for empty or very short messages
        if (!messageContent || messageContent.trim().length < 3) {
            console.log('⏭️  Skipping analysis: message too short');
            return {
                status: 'safe',
                score: 0,
            };
        }

        console.log(`🔍 Analyzing message for safety...`);
        console.log(`📤 Calling Hugging Face API: ${MESSAGE_DETECTOR_URL}/predict`);
        console.log(`📝 Message: "${messageContent.trim().substring(0, 50)}..."`);

        const response = await axios.post(
            `${MESSAGE_DETECTOR_URL}/predict`,
            { text: messageContent.trim() },
            {
                timeout: 30000,  // 30 second timeout for HF
                headers: { 'Content-Type': 'application/json' }
            }
        );

        console.log(`📥 AI Response received:`);
        console.log(`   Response data:`, JSON.stringify(response.data));

        // Parse response based on API format
        let status = 'safe';
        let score = 0;

        if (response.data.prediction) {
            console.log(`   Prediction: ${response.data.prediction}`);
            status = response.data.prediction.toLowerCase().includes('safe') ? 'safe' : 'unsafe';
            score = response.data.score || 0;
        }

        const result = {
            status,
            score,
        };

        console.log(`✅ Analysis complete: ${result.status} (confidence: ${(result.score * 100).toFixed(1)}%)`);
        return result;

    } catch (error) {
        console.error('❌ AI Service Error:');
        console.error(`   Message: ${error.message}`);
        console.error(`   Code: ${error.code}`);
        console.error(`   URL: ${AI_SERVICE_URL}predict`);
        if (error.response?.status) {
            console.error(`   HTTP Status: ${error.response.status}`);
            console.error(`   Response: ${JSON.stringify(error.response.data)}`);
        }

        // Fallback: Mark as pending if AI service is unavailable
        console.log('⚠️  Falling back to "pending" status');
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
