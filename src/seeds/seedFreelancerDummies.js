/**
 * seeds/seedFreelancerDummies.js
 * Seed freelancer mock data for development/testing
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const DUMMY_FREELANCERS = [
  {
    fullName: 'Aisha Khan',
    email: 'demo.aisha@openwork.io',
    title: 'Senior Full Stack Developer',
    bio: 'I build scalable MERN applications with clean architecture, strong testing discipline, and production-grade deployment practices.',
    skills: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'GraphQL'],
    hourlyRate: 35,
    experienceLevel: 'senior',
    location: 'Lahore, Pakistan',
    aiSkillScore: 93,
    averageRating: 4.9,
    totalReviews: 42,
    completedJobs: 58,
    totalEarned: 18600,
    availability: 'available',
    certifications: [
      { skill: 'React Advanced', score: 48, total: 50, pct: 96, passed: true },
      { skill: 'Node.js APIs', score: 45, total: 50, pct: 90, passed: true },
    ],
  },
  {
    fullName: 'Rahul Sharma',
    email: 'demo.rahul@openwork.io',
    title: 'UI/UX Product Designer',
    bio: 'Product-focused designer specialized in fintech and SaaS. I ship design systems, prototypes, and developer-ready handoff.',
    skills: ['UI/UX', 'Figma', 'Design Systems', 'User Research', 'Prototyping'],
    hourlyRate: 28,
    experienceLevel: 'mid',
    location: 'Karachi, Pakistan',
    aiSkillScore: 89,
    averageRating: 4.8,
    totalReviews: 33,
    completedJobs: 41,
    totalEarned: 12900,
    availability: 'available',
    certifications: [
      { skill: 'UX Research', score: 44, total: 50, pct: 88, passed: true },
    ],
  },
  {
    fullName: 'Muhammad Hassan',
    email: 'demo.hassan@openwork.io',
    title: 'Data Scientist',
    bio: 'I design practical machine learning pipelines for ranking, classification, and NLP use-cases with measurable business outcomes.',
    skills: ['Python', 'Pandas', 'NLP', 'TensorFlow', 'SQL'],
    hourlyRate: 40,
    experienceLevel: 'senior',
    location: 'Islamabad, Pakistan',
    aiSkillScore: 91,
    averageRating: 4.7,
    totalReviews: 27,
    completedJobs: 36,
    totalEarned: 22100,
    availability: 'available',
    certifications: [
      { skill: 'Machine Learning', score: 46, total: 50, pct: 92, passed: true },
    ],
  },
  {
    fullName: 'Fatima Aziz',
    email: 'demo.fatima@openwork.io',
    title: 'Mobile App Engineer',
    bio: 'Mobile-first engineer building high-performance cross-platform apps using React Native and Firebase with polished UX.',
    skills: ['React Native', 'Firebase', 'Android', 'iOS', 'Mobile Development'],
    hourlyRate: 30,
    experienceLevel: 'mid',
    location: 'Remote',
    aiSkillScore: 88,
    averageRating: 4.8,
    totalReviews: 25,
    completedJobs: 32,
    totalEarned: 14000,
    availability: 'available',
  },
  {
    fullName: 'Ali Raza',
    email: 'demo.ali@openwork.io',
    title: 'DevOps Engineer',
    bio: 'Cloud and automation specialist focused on resilient CI/CD pipelines, infrastructure as code, and production observability.',
    skills: ['DevOps', 'AWS', 'Docker', 'CI/CD', 'Kubernetes'],
    hourlyRate: 33,
    experienceLevel: 'senior',
    location: 'Multan, Pakistan',
    aiSkillScore: 86,
    averageRating: 4.6,
    totalReviews: 19,
    completedJobs: 28,
    totalEarned: 16300,
    availability: 'busy',
  },
  {
    fullName: 'Noor Sheikh',
    email: 'demo.noor@openwork.io',
    title: 'Content Strategist',
    bio: 'Content and growth specialist helping brands scale with SEO, editorial systems, and conversion-focused copy.',
    skills: ['SEO', 'Copywriting', 'Content Writing', 'Editing', 'Analytics'],
    hourlyRate: 22,
    experienceLevel: 'mid',
    location: 'Sukkur, Pakistan',
    aiSkillScore: 87,
    averageRating: 4.9,
    totalReviews: 31,
    completedJobs: 45,
    totalEarned: 9800,
    availability: 'available',
  },
];

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in environment variables');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const hashedPassword = await bcrypt.hash('Password123!', 12);

  for (const freelancer of DUMMY_FREELANCERS) {
    const doc = {
      ...freelancer,
      role: 'freelancer',
      isVerified: true,
      isActive: true,
      isBanned: false,
      canActAsFreelancer: true,
      canActAsClient: false,
      password: hashedPassword,
    };

    const result = await User.findOneAndUpdate(
      { email: freelancer.email.toLowerCase() },
      { $set: doc },
      { upsert: true, new: true, runValidators: true }
    );

    result.recalcAIRank();
    await result.save({ validateBeforeSave: false });

    console.log(`• Upserted freelancer: ${freelancer.fullName}`);
  }

  const totalFreelancers = await User.countDocuments({ role: 'freelancer', isActive: true, isBanned: false });
  console.log(`✅ Dummy freelancers synced. Active freelancers now: ${totalFreelancers}`);

  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('❌ Failed to seed freelancer dummies:', err.message);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
