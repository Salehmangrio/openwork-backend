/**
 * seeds/seedFreelancerReviews.js
 * Seed freelancer review/rating data for development/testing
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { Order, Review } = require('../models/index');

const REVIEW_MAP = {
  'Aisha Khan': {
    rating: 5,
    comment: 'Aisha delivered clean, scalable code ahead of schedule. Communication was fast and implementation quality was excellent.',
  },
  'Rahul Sharma': {
    rating: 5,
    comment: 'Rahul transformed our rough wireframes into a polished product design system. Great collaboration and attention to detail.',
  },
  'Muhammad Hassan': {
    rating: 5,
    comment: 'Muhammad built a robust ML workflow and explained tradeoffs clearly. Strong technical depth and practical execution.',
  },
  'Fatima Aziz': {
    rating: 4,
    comment: 'Fatima shipped a smooth mobile experience with good performance. Very responsive and reliable throughout the project.',
  },
  'Ali Raza': {
    rating: 5,
    comment: 'Ali improved our CI/CD and infra setup significantly. Deployment reliability and observability are much better now.',
  },
  'Noor Sheikh': {
    rating: 5,
    comment: 'Noor produced high-converting SEO content with clear structure and strong keyword strategy. Great writing quality.',
  },
};

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in environment variables');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Ensure a client exists to author sample reviews.
  const clientPassword = await bcrypt.hash('Password123!', 12);
  const client = await User.findOneAndUpdate(
    { email: 'demo.client@openwork.io' },
    {
      $set: {
        fullName: 'TechBridge Client',
        email: 'demo.client@openwork.io',
        password: clientPassword,
        role: 'client',
        isVerified: true,
        isActive: true,
        canActAsClient: true,
        canActAsFreelancer: false,
        companyName: 'TechBridge Solutions',
        organizationType: 'startup',
        location: 'Karachi, Pakistan',
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  const freelancers = await User.find({
    role: 'freelancer',
    email: { $regex: '^demo\\.', $options: 'i' },
    isActive: true,
  }).select('_id fullName hourlyRate');

  if (!freelancers.length) {
    console.log('⚠️ No demo freelancers found. Run seed:freelancers first.');
    await mongoose.connection.close();
    process.exit(0);
  }

  for (const freelancer of freelancers) {
    const reviewPreset = REVIEW_MAP[freelancer.fullName] || {
      rating: 5,
      comment: `${freelancer.fullName} delivered excellent work and was easy to collaborate with.`,
    };

    const orderTitle = `Completed Project with ${freelancer.fullName}`;
    const orderAmount = Math.max(300, Math.round((freelancer.hourlyRate || 25) * 20));
    const platformFee = Math.round(orderAmount * 0.05 * 100) / 100;

    const order = await Order.findOneAndUpdate(
      {
        client: client._id,
        freelancer: freelancer._id,
        title: orderTitle,
      },
      {
        $set: {
          client: client._id,
          freelancer: freelancer._id,
          title: orderTitle,
          description: `Demo completed engagement for ${freelancer.fullName}.`,
          totalAmount: orderAmount,
          platformFee,
          freelancerPayout: orderAmount - platformFee,
          status: 'completed',
          progress: 100,
          escrowReleased: true,
          deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await Review.findOneAndUpdate(
      {
        order: order._id,
        reviewer: client._id,
        reviewee: freelancer._id,
      },
      {
        $set: {
          order: order._id,
          reviewer: client._id,
          reviewee: freelancer._id,
          rating: reviewPreset.rating,
          comment: reviewPreset.comment,
          reviewType: 'client_to_freelancer',
          isPublic: true,
          categories: {
            communication: reviewPreset.rating,
            quality: reviewPreset.rating,
            expertise: reviewPreset.rating,
            timeliness: reviewPreset.rating,
          },
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    console.log(`• Review seeded for ${freelancer.fullName}`);
  }

  console.log(`✅ Seeded completed orders + reviews for ${freelancers.length} freelancers`);
  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('❌ Failed to seed reviews:', err.message);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});

