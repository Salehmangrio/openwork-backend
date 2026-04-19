/**
 * seeds/seedConversations.js
 * Seed conversation and message data for development/testing
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ DB connected for conversation seeding');
};

const seedConversations = async () => {
  await connectDB();

  // Find users
  const [chander, aisha, rahul] = await User.find({ 
    $or: [
      { email: 'chander@openwork.io' },
      { email: 'aisha@openwork.io' },
      { email: 'rahul@techbridge.io' }
    ] 
  });

  if (!chander || !aisha || !rahul) {
    console.log('❌ Demo users not found. Run main seed first.');
    process.exit(1);
  }

  // Clear existing conversations between these users
  await Conversation.deleteMany({
    participants: { $in: [chander._id, aisha._id, rahul._id] }
  });

  // Conversation 1: Chander ↔ Aisha (freelancer chat)
  const conv1 = await Conversation.create({
    participants: [chander._id, aisha._id]
  });

  await Message.create([
    {
      conversation: conv1._id,
      sender: chander._id,
      content: 'Hi Aisha! Thanks for your proposal on the React dashboard project. Can you share your GitHub portfolio?',
      messageType: 'text'
    },
    {
      conversation: conv1._id,
      sender: aisha._id,
      content: 'Hi Chander! Here is my GitHub: https://github.com/aishakhan/portfolio. I specialize in TypeScript + Next.js projects. Happy to hop on a quick call to discuss requirements.',
      messageType: 'text'
    },
    {
      conversation: conv1._id,
      sender: chander._id,
      content: 'Perfect! Let\'s schedule a 15min call tomorrow 2PM PKT. Can you do milestone 1 (wireframes) first?',
      messageType: 'text'
    }
  ]);

  // Conversation 2: Chander ↔ Rahul (client-freelancer)
  const conv2 = await Conversation.create({
    participants: [chander._id, rahul._id]
  });

  await Message.create([
    {
      conversation: conv2._id,
      sender: rahul._id,
      content: 'Hey Chander, milestone 2 API integration looks great! Funds released. Can you start final testing phase?',
      messageType: 'text'
    },
    {
      conversation: conv2._id,
      sender: chander._id,
      content: 'Thanks Rahul! Testing phase started. Will deliver final build by Friday EOD with full documentation.',
      messageType: 'text'
    }
  ]);

  console.log('✅ 2 test conversations + 5 messages seeded!');
  console.log(`Conv1 ID: ${conv1._id} (Chander ↔ Aisha)`);
  console.log(`Conv2 ID: ${conv2._id} (Chander ↔ Rahul)`);
  process.exit(0);
};

seedConversations();
