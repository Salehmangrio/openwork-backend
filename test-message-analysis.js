// SERVER DIAGNOSTIC: Check if message prediction is working
// Run this in your server console or add to a test endpoint

const axios = require('axios');

const AI_SERVICE_URL = process.env.MESSAGE_AI_URL || 'http://localhost:7860';

async function testMessageAnalysis() {
  console.log('\n🔍 MESSAGE ANALYSIS DIAGNOSTIC\n');
  console.log('='.repeat(50));
  
  // 1. Check AI service URL
  console.log(`✓ AI_SERVICE_URL: ${AI_SERVICE_URL}`);
  
  // 2. Test AI service connectivity
  console.log('\n📡 Testing AI Service Connection...');
  try {
    const healthCheck = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
    console.log('✅ AI Service is ONLINE');
    console.log(`   Status: ${healthCheck.data.status}`);
    console.log(`   Model Loaded: ${healthCheck.data.model_loaded}`);
  } catch (error) {
    console.log('❌ AI Service is OFFLINE or NOT RESPONDING');
    console.log(`   Error: ${error.message}`);
    console.log(`   Tried: ${AI_SERVICE_URL}/health`);
    return;
  }

  // 3. Test prediction
  console.log('\n🧪 Testing Prediction with Sample Messages...');
  
  const testMessages = [
    { text: 'Hello, how are you?', expected: 'Safe' },
    { text: 'Hi, email me at john@example.com', expected: 'Unsafe (Contact)' },
    { text: 'Call me on +1234567890', expected: 'Unsafe (Contact)' },
  ];

  for (const msg of testMessages) {
    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/predict`,
        { text: msg.text },
        { timeout: 10000 }
      );
      
      console.log(`\n   Input: "${msg.text}"`);
      console.log(`   Prediction: ${response.data.prediction}`);
      console.log(`   Score: ${response.data.score}`);
      console.log(`   Expected: ${msg.expected}`);
    } catch (error) {
      console.log(`\n   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(50) + '\n');
}

// Run the test
testMessageAnalysis();
