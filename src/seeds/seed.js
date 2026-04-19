// ============================================================
// seeds/seed.js — Populate database with demo data
// Run: cd server && npm run seed
// ============================================================
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Job = require('../models/Job');
const { Offer, Proposal, Order, Payment, Review, Notification } = require('../models/index');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ DB connected for seeding');
};

const clearDB = async () => {
  await Promise.all([
    User.deleteMany(),
    Job.deleteMany(),
    Offer.deleteMany(),
    Proposal.deleteMany(),
    Order.deleteMany(),
    Payment.deleteMany(),
    Review.deleteMany(),
    Notification.deleteMany(),
  ]);
  console.log('🗑️  Database cleared');
};

const seedUsers = async () => {
  const password = await bcrypt.hash('Password123!', 12);

  const users = await User.insertMany([
    // Admin
    {
      fullName: 'Admin User', email: 'admin@openwork.io', password,
      role: 'admin', isVerified: true, aiSkillScore: 100,
    },
    // Freelancers
    {
      fullName: 'Aisha Khan', email: 'aisha@openwork.io', password,
      role: 'freelancer', isVerified: true,
      title: 'Full Stack Developer', bio: 'Expert MERN stack developer with 5+ years experience building scalable SaaS products.',
      skills: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'GraphQL'],
      hourlyRate: 45, experienceLevel: 'senior', location: 'Lahore, Pakistan',
      aiSkillScore: 92, aiRankScore: 88, averageRating: 4.9, totalReviews: 134,
      completedJobs: 48, totalEarned: 24500, walletBalance: 3200,
      certifications: [
        { skill: 'React.js Advanced', score: 5, total: 5, pct: 100, passed: true },
        { skill: 'Node.js Developer', score: 4, total: 5, pct: 80, passed: true },
      ],
    },
    {
      fullName: 'Riya Kapoor', email: 'riya@openwork.io', password,
      role: 'freelancer', isVerified: true,
      title: 'UI/UX Designer', bio: 'Creating beautiful, user-centered digital experiences.',
      skills: ['Figma', 'Prototyping', 'Branding', 'Design Systems', 'CSS'],
      hourlyRate: 38, experienceLevel: 'mid', location: 'Mumbai, India',
      aiSkillScore: 88, aiRankScore: 82, averageRating: 4.8, totalReviews: 87,
      completedJobs: 62, totalEarned: 18600, walletBalance: 1500,
    },
    {
      fullName: 'Hassan Ali', email: 'hassan@openwork.io', password,
      role: 'freelancer', isVerified: true,
      title: 'Data Scientist & ML Engineer',
      bio: 'ML researcher with published papers in NLP.',
      skills: ['Python', 'TensorFlow', 'SQL', 'Scikit-learn', 'FastAPI'],
      hourlyRate: 60, experienceLevel: 'senior', location: 'Karachi, Pakistan',
      aiSkillScore: 95, aiRankScore: 93, averageRating: 4.7, totalReviews: 56,
      completedJobs: 31, totalEarned: 31000,
    },
    {
      fullName: 'Sara Ahmed', email: 'sara@openwork.io', password,
      role: 'freelancer', isVerified: true,
      title: 'Flutter Mobile Developer',
      skills: ['Flutter', 'React Native', 'Firebase', 'Dart', 'iOS'],
      hourlyRate: 50, experienceLevel: 'senior', location: 'Islamabad, Pakistan',
      aiSkillScore: 90, aiRankScore: 89, averageRating: 4.9, totalReviews: 112,
      completedJobs: 74,
    },
    {
      fullName: 'Fatima Malik', email: 'fatima@openwork.io', password,
      role: 'freelancer', isVerified: true,
      title: 'Content Writer & SEO Specialist',
      skills: ['SEO', 'Copywriting', 'Blogging', 'Analytics', 'HubSpot'],
      hourlyRate: 25, experienceLevel: 'mid', location: 'Karachi, Pakistan',
      aiSkillScore: 85, aiRankScore: 80, averageRating: 4.8, totalReviews: 201,
      completedJobs: 189,
    },
    // Clients
    {
      fullName: 'Rahul Sharma', email: 'rahul@techbridge.io', password,
      role: 'client', isVerified: true,
      companyName: 'TechBridge Solutions', organizationType: 'startup',
      location: 'Bangalore, India', totalSpent: 52300,
    },
    {
      fullName: 'Chander Kumar', email: 'chander@openwork.io', password,
      role: 'freelancer', isVerified: true,
      title: 'Full Stack Developer', bio: 'Experienced Full Stack Developer with 5+ years building scalable web applications.',
      skills: ['React.js', 'Node.js', 'MongoDB', 'Python', 'TailwindCSS', 'GraphQL', 'TypeScript'],
      hourlyRate: 45, experienceLevel: 'mid', location: 'Sukkur, Pakistan',
      aiSkillScore: 87, aiRankScore: 84, averageRating: 4.9, totalReviews: 48,
      completedJobs: 48, totalEarned: 24500, walletBalance: 3200,
    },
  ]);

  console.log(`✅ ${users.length} users seeded`);
  return users;
};

const seedJobs = async (users) => {
  const client = users.find(u => u.role === 'client');
  const jobs = await Job.insertMany([
    {
      client: client._id,
      title: 'Senior React.js Developer for SaaS Platform',
      description: 'We are looking for an experienced full-stack developer to help build our enterprise SaaS dashboard with React 18, TypeScript, Redux Toolkit. Must have experience with complex state management and real-time data visualization.',
      category: 'Web Development',
      skills: ['React', 'TypeScript', 'Redux', 'REST APIs', 'Node.js'],
      budgetType: 'fixed', budgetMin: 2000, budgetMax: 5000,
      duration: '1 month', isUrgent: true, proposalCount: 14,
    },
    {
      client: client._id,
      title: 'Brand Identity & Logo Design for Startup',
      description: 'We need a complete brand identity package: logo (primary + variations), color palette, typography guidelines, and a brand style guide PDF. Fintech space — professional, modern, trustworthy.',
      category: 'Graphic Design',
      skills: ['Logo Design', 'Branding', 'Illustrator', 'Figma'],
      budgetType: 'fixed', budgetMin: 300, budgetMax: 800,
      duration: '1–2 weeks', proposalCount: 8,
    },
    {
      client: client._id,
      title: 'Python ML Engineer — Recommendation System',
      description: 'Build a collaborative filtering recommendation engine for our e-commerce platform. Must have TensorFlow experience and ability to work with large datasets (5M+ records). Include A/B testing framework.',
      category: 'Data Science / AI',
      skills: ['Python', 'TensorFlow', 'ML', 'SQL', 'FastAPI'],
      budgetType: 'fixed', budgetMin: 3000, budgetMax: 8000,
      duration: '2–3 months', isUrgent: true, proposalCount: 6,
    },
    {
      client: client._id,
      title: 'Flutter Mobile App — Food Delivery Platform',
      description: 'Full-featured food delivery app with real-time GPS tracking, push notifications, Stripe payments, and restaurant management dashboard. iOS + Android. Firebase backend.',
      category: 'Mobile Development',
      skills: ['Flutter', 'Firebase', 'Stripe', 'Google Maps API'],
      budgetType: 'fixed', budgetMin: 4000, budgetMax: 7000,
      duration: '2–3 months', proposalCount: 11,
    },
    {
      client: client._id,
      title: 'UI/UX Designer for Fintech Analytics Dashboard',
      description: 'Design a comprehensive analytics dashboard for our payment platform. Dark mode, data visualization, mobile-first. Must deliver Figma files with component library and developer handoff specs.',
      category: 'UI/UX Design',
      skills: ['Figma', 'Data Visualization', 'UX Research', 'Component Design'],
      budgetType: 'fixed', budgetMin: 1500, budgetMax: 3000,
      duration: '1 month', proposalCount: 19,
    },
  ]);
  console.log(`✅ ${jobs.length} jobs seeded`);
  return jobs;
};

const seedOffers = async (users) => {
  const freelancers = users.filter(u => u.role === 'freelancer');
  const aisha = freelancers.find(u => u.fullName === 'Aisha Khan');
  const riya = freelancers.find(u => u.fullName === 'Riya Kapoor');
  const hassan = freelancers.find(u => u.fullName === 'Hassan Ali');

  const offers = await Offer.insertMany([
    {
      seller: aisha._id,
      title: 'Full-Stack React + Node.js Web Application',
      description: 'I will build a complete, production-ready web application using React 18, Node.js, MongoDB, and TypeScript. Includes authentication, RESTful API, responsive UI, and deployment setup.',
      category: 'Web Development',
      packages: [
        { name: 'basic', title: 'Landing Page', description: 'Landing page + basic CRUD operations', price: 299, deliveryDays: 14, revisions: 2 },
        { name: 'standard', title: 'Full App', description: 'Full web app + auth + database + API', price: 699, deliveryDays: 10, revisions: 3 },
        { name: 'premium', title: 'Enterprise', description: 'Everything + CI/CD + tests + deployment', price: 1299, deliveryDays: 7, revisions: 5 },
      ],
      avgRating: 4.9, totalReviews: 134, totalOrders: 48,
    },
    {
      seller: riya._id,
      title: 'UI/UX Design with Figma + Full Prototyping',
      description: 'Professional UI/UX design with interactive prototypes, component library, and developer handoff documentation. Specialized in SaaS dashboards and mobile apps.',
      category: 'UI/UX Design',
      packages: [
        { name: 'basic', title: 'Starter', description: '3 screens + style guide', price: 149, deliveryDays: 5, revisions: 2 },
        { name: 'standard', title: 'Professional', description: '10 screens + prototype + component library', price: 349, deliveryDays: 7, revisions: 3 },
        { name: 'premium', title: 'Complete', description: 'Full app design + prototype + handoff docs', price: 699, deliveryDays: 10, revisions: 5 },
      ],
      avgRating: 4.8, totalReviews: 87, totalOrders: 62,
    },
    {
      seller: hassan._id,
      title: 'Machine Learning Model Training & Deployment',
      description: 'Custom ML model development using Python, TensorFlow/PyTorch, scikit-learn. Includes data preprocessing, model training, evaluation, and REST API deployment.',
      category: 'Data Science / AI',
      packages: [
        { name: 'basic', title: 'Model Only', description: 'Model training + evaluation report', price: 399, deliveryDays: 10, revisions: 1 },
        { name: 'standard', title: 'Model + API', description: 'Model + FastAPI endpoint + documentation', price: 899, deliveryDays: 14, revisions: 2 },
        { name: 'premium', title: 'MLOps Pipeline', description: 'Full MLOps pipeline with monitoring', price: 1799, deliveryDays: 21, revisions: 3 },
      ],
      avgRating: 4.7, totalReviews: 56, totalOrders: 31,
    },
  ]);
  console.log(`✅ ${offers.length} offers seeded`);
  return offers;
};

const seedOrders = async (users, jobs) => {
  const client = users.find(u => u.role === 'client');
  const aisha = users.find(u => u.fullName === 'Aisha Khan');
  const chander = users.find(u => u.fullName === 'Chander Kumar');

  const orders = await Order.insertMany([
    {
      job: jobs[0]._id,
      client: client._id,
      freelancer: chander._id,
      title: 'React E-Commerce Dashboard',
      packageName: 'premium',
      totalAmount: 2400,
      platformFee: 120,
      freelancerPayout: 2280,
      status: 'in_progress',
      progress: 65,
      deliveryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      milestones: [
        { title: 'UI Wireframes', amount: 400, status: 'approved' },
        { title: 'Component Library', amount: 600, status: 'approved' },
        { title: 'API Integration', amount: 900, status: 'pending' },
        { title: 'Testing & QA', amount: 500, status: 'pending' },
      ],
    },
    {
      job: jobs[1]._id,
      client: client._id,
      freelancer: aisha._id,
      title: 'Node.js REST API Development',
      packageName: 'standard',
      totalAmount: 1800,
      platformFee: 90,
      freelancerPayout: 1710,
      status: 'delivered',
      progress: 95,
      deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(),
    },
  ]);
  console.log(`✅ ${orders.length} orders seeded`);
  return orders;
};

const seedNotifications = async (users) => {
  const chander = users.find(u => u.fullName === 'Chander Kumar');
  if (!chander) return;

  await Notification.insertMany([
    { recipient: chander._id, type: 'new_message', title: 'New Message from Riya Kapoor', message: 'Hey! I reviewed your proposal. Can we schedule a call?', link: '/messages', isRead: false },
    { recipient: chander._id, type: 'payment_released', title: 'Payment Released — $450', message: 'Node.js API Development payment released from escrow.', link: '/payments', isRead: false },
    { recipient: chander._id, type: 'job_match', title: '🎯 New AI Job Match!', message: '3 new jobs match your skill profile in Web Development.', link: '/jobs', isRead: false },
    { recipient: chander._id, type: 'review_received', title: '⭐ New 5-Star Review', message: 'TechBridge Solutions gave you 5 stars!', link: '/profile', isRead: true },
  ]);
  console.log('✅ Notifications seeded');
};

const seed = async () => {
  try {
    await connectDB();
    await clearDB();
    const users = await seedUsers();
    const jobs = await seedJobs(users);
    const offers = await seedOffers(users);
    const orders = await seedOrders(users, jobs);
    await seedNotifications(users);

    console.log('\n🌱 Database seeded successfully!');
    console.log('─────────────────────────────────');
    console.log('Demo Accounts:');
    console.log('  Admin:      admin@openwork.io    / Password123!');
    console.log('  Freelancer: chander@openwork.io  / Password123!');
    console.log('  Client:     rahul@techbridge.io  / Password123!');
    console.log('─────────────────────────────────');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed();
