const aiService = require('./aiService');

/**
 * Call the message detection AI service to analyze message content
 * @param {string} messageContent - The message text to analyze
 * @returns {Promise<{status: string, reason: string}>} - Safe/Unsafe status and reason
 */
const analyzeMessageContent = async (messageContent) => {
    try {
        // Skip analysis for empty or very short messages
        if (!messageContent || messageContent.trim().length < 3) {
            console.log('⏭️  Skipping analysis: message too short');
            return {
                status: 'safe',
                reason: 'message too short',
            };
        }

        console.log(`🔍 Analyzing message for safety...`);
        console.log(` Message: "${messageContent.trim().substring(0, 50)}..."`);

        const result = await aiService.moderate(messageContent.trim());

        console.log(`📥 AI Response received:`);
        console.log(`   Response data:`, JSON.stringify(result));

        let status = 'safe';

        if (result.verdict === 'UNSAFE') {
            status = 'unsafe';
        } else {
            status = 'safe';
        }

        const analysisResult = {
            status: status,
            reason: result.reason || 'analysis complete',
        };

        console.log(`✅ Analysis complete: ${analysisResult.status}`);
        return analysisResult;

    } catch (error) {
        console.error('❌ AI Service Error:');
        console.error(`   Message: ${error.message}`);
        console.error(`   Code: ${error.code}`);
        if (error.response?.status) {
            console.error(`   HTTP Status: ${error.response.status}`);
            console.error(`   Response: ${JSON.stringify(error.response.data)}`);
        }

        // Fallback: Mark as pending if AI service is unavailable
        console.log('⚠️  Falling back to "pending" status');
        return {
            status: 'pending',
            reason: 'ai service unavailable',
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
        return messages.map(
            () => ({ status: 'pending', reason: 'ai service unavailable' })
        );
    }
};

module.exports = {
    analyzeMessageContent,
    analyzeMessageBatch,
};
