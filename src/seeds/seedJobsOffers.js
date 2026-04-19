/**
 * seeds/seedJobsOffers.js
 * Seed jobs and offers data for development/testing
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Job = require('../models/Job');
const { Offer } = require('../models/index');

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in environment variables');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Get or create demo client
  const client = await User.findOne({ email: 'demo.client@openwork.io' });
  if (!client) {
    console.log('⚠️  Demo client not found. Run seed:freelancers first.');
    await mongoose.connection.close();
    process.exit(0);
  }

  // Get demo freelancers
  const freelancers = await User.find({
    role: 'freelancer',
    email: { $regex: '^demo\\.', $options: 'i' },
    isActive: true,
  }).select('_id fullName');

  if (!freelancers.length) {
    console.log('⚠️  No demo freelancers found. Run seed:freelancers first.');
    await mongoose.connection.close();
    process.exit(0);
  }

  // ─────────────────────────────────────────────────────────────
  // SEED JOBS
  // ─────────────────────────────────────────────────────────────

  const jobTemplates = [
    {
      title: 'Build Full Stack SaaS Platform',
      description: 'We need a complete SaaS platform built with MERN stack including user authentication, payment integration, and real-time notifications. Must be production-ready with tests.',
      category: 'Web Development',
      skills: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'Stripe'],
      budgetType: 'fixed',
      budgetMin: 5000,
      budgetMax: 8000,
      duration: '3+ months',
      experienceLevel: 'senior',
      isUrgent: true,
    },
    {
      title: 'Mobile App - Fitness Tracking',
      description: 'Looking for React Native developer to build a cross-platform fitness tracking mobile app with push notifications, user profiles, and workout logging features.',
      category: 'Mobile Development',
      skills: ['React Native', 'Firebase', 'Redux', 'APIs'],
      budgetType: 'fixed',
      budgetMin: 3000,
      budgetMax: 5000,
      duration: '2–3 months',
      experienceLevel: 'mid',
      isUrgent: false,
    },
    {
      title: 'Design System for E-Commerce Platform',
      description: 'Need a comprehensive design system with Figma components, design tokens, and developer handoff documentation. Should include patterns for common e-commerce use cases.',
      category: 'UI/UX Design',
      skills: ['Figma', 'Design Systems', 'UI Design', 'User Research'],
      budgetType: 'fixed',
      budgetMin: 2000,
      budgetMax: 3500,
      duration: '1 month',
      experienceLevel: 'mid',
      isUrgent: false,
    },
    {
      title: 'Machine Learning Model - Customer Churn Prediction',
      description: 'Build and deploy an ML model to predict customer churn. Include data preprocessing, model training, evaluation metrics, and REST API for predictions.',
      category: 'Data Science / AI',
      skills: ['Python', 'Machine Learning', 'TensorFlow', 'Flask', 'SQL'],
      budgetType: 'fixed',
      budgetMin: 2500,
      budgetMax: 4000,
      duration: '1 month',
      experienceLevel: 'senior',
      isUrgent: true,
    },
    {
      title: 'API Development & Documentation',
      description: 'Build robust RESTful APIs for our platform using Node.js/Express. Include OpenAPI/Swagger documentation, authentication, rate limiting, and comprehensive error handling.',
      category: 'Web Development',
      skills: ['Node.js', 'Express', 'MongoDB', 'OpenAPI', 'Docker'],
      budgetType: 'hourly',
      budgetMin: 40,
      budgetMax: 60,
      duration: '2–3 months',
      experienceLevel: 'senior',
      isUrgent: false,
    },
    {
      title: 'WordPress Site Redesign',
      description: 'Redesign our existing WordPress site with modern UI/UX, improved performance, mobile responsiveness, and SEO optimization. Includes CMS training.',
      category: 'Web Development',
      skills: ['WordPress', 'HTML', 'CSS', 'JavaScript', 'SEO'],
      budgetType: 'fixed',
      budgetMin: 1500,
      budgetMax: 2500,
      duration: '1–2 weeks',
      experienceLevel: 'mid',
      isUrgent: false,
    },
    {
      title: 'DevOps Setup & Infrastructure',
      description: 'Set up complete CI/CD pipeline, containerization with Docker, Kubernetes orchestration, and AWS infrastructure. Include monitoring and alerting. 24/7 on-call support.',
      category: 'DevOps & Cloud',
      skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform'],
      budgetType: 'hourly',
      budgetMin: 60,
      budgetMax: 85,
      duration: 'ongoing',
      experienceLevel: 'senior',
      isUrgent: true,
    },
    {
      title: 'Content Writing - Tech Blog',
      description: 'Write 20 high-quality tech blog posts (1500-2000 words each) about web development best practices, frameworks, and industry trends. Needs SEO optimization.',
      category: 'Content Writing',
      skills: ['Content Writing', 'Technical Writing', 'SEO', 'Blogging'],
      budgetType: 'fixed',
      budgetMin: 800,
      budgetMax: 1200,
      duration: '1 month',
      experienceLevel: 'mid',
      isUrgent: false,
    },
    {
      title: 'Real-Time Chat Application',
      description: 'Build a real-time chat application using Socket.io, React, and Node.js. Features include user typing indicators, message history, and file sharing.',
      category: 'Web Development',
      skills: ['React', 'Node.js', 'Socket.io', 'MongoDB', 'TypeScript'],
      budgetType: 'fixed',
      budgetMin: 2000,
      budgetMax: 3500,
      duration: '1–2 weeks',
      experienceLevel: 'mid',
      isUrgent: false,
    },
    {
      title: 'Cybersecurity Audit & Penetration Testing',
      description: 'Conduct comprehensive security audit of our web application. Include penetration testing, vulnerability assessment, and detailed security report with recommendations.',
      category: 'Cybersecurity',
      skills: ['Security Testing', 'Penetration Testing', 'OWASP', 'Web Security'],
      budgetType: 'fixed',
      budgetMin: 3000,
      budgetMax: 5000,
      duration: '1–2 weeks',
      experienceLevel: 'senior',
      isUrgent: true,
    },
    {
      title: 'Blockchain Smart Contracts',
      description: 'Develop and audit Ethereum smart contracts for a DeFi platform. Must include comprehensive test coverage, security best practices, and documentation.',
      category: 'Blockchain',
      skills: ['Solidity', 'Ethereum', 'Web3.js', 'Hardhat', 'Security'],
      budgetType: 'fixed',
      budgetMin: 4000,
      budgetMax: 7000,
      duration: '1 month',
      experienceLevel: 'senior',
      isUrgent: false,
    },
    {
      title: 'Landing Page Design & Development',
      description: 'Create a high-converting landing page with modern design, smooth animations, and optimized conversion funnel. Includes A/B testing setup.',
      category: 'Web Development',
      skills: ['React', 'CSS', 'Animation', 'UX/UI', 'Analytics'],
      budgetType: 'fixed',
      budgetMin: 1000,
      budgetMax: 2000,
      duration: '< 1 week',
      experienceLevel: 'mid',
      isUrgent: false,
    },
    {
      title: 'E-Commerce Backend Integration',
      description: 'Integrate payment gateway (Stripe/PayPal), inventory management, order tracking system, and shipping APIs into existing e-commerce platform.',
      category: 'Web Development',
      skills: ['Node.js', 'Stripe API', 'MongoDB', 'REST APIs', 'Payment Processing'],
      budgetType: 'fixed',
      budgetMin: 2500,
      budgetMax: 4000,
      duration: '1–2 weeks',
      experienceLevel: 'mid',
      isUrgent: true,
    },
  ];

  for (const job of jobTemplates) {
    await Job.findOneAndUpdate(
      {
        client: client._id,
        title: job.title,
      },
      {
        $set: {
          ...job,
          client: client._id,
          status: 'open',
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
  }
  console.log(`✅ Seeded ${jobTemplates.length} jobs`);

  // ─────────────────────────────────────────────────────────────
  // SEED OFFERS
  // ─────────────────────────────────────────────────────────────

  const offerTemplates = [
    {
      seller: freelancers[0], // Aisha Khan
      title: 'Full Stack Web Development - MERN Stack',
      description: 'I build scalable, production-ready web applications using MERN stack. Includes architecture design, testing, and DevOps guidance.',
      category: 'Web Development',
      tags: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'Full Stack'],
      packages: [
        {
          name: 'basic',
          title: 'Basic Web App',
          description: 'Simple CRUD application with basic authentication',
          price: 500,
          deliveryDays: 7,
          revisions: 2,
          features: ['User Authentication', 'REST API', 'Database Design', 'Basic UI'],
        },
        {
          name: 'standard',
          title: 'Professional SaaS App',
          description: 'Full-featured SaaS application with advanced features',
          price: 1500,
          deliveryDays: 14,
          revisions: 4,
          features: ['Complete SaaS Features', 'Payment Integration', 'Email Notifications', 'Admin Dashboard', 'Performance Optimization'],
        },
        {
          name: 'premium',
          title: 'Enterprise Solution',
          description: 'Complex enterprise application with scaling, security hardening',
          price: 3000,
          deliveryDays: 30,
          revisions: 6,
          features: ['Enterprise Architecture', 'Advanced Security', 'CI/CD Setup', 'Load Testing', 'Ongoing Support'],
        },
      ],
    },
    {
      seller: freelancers[1], // Rahul Sharma
      title: 'UI/UX Design - Complete Design System',
      description: 'Professional UI/UX design services. I create design systems, prototypes, and handoff-ready assets for developers.',
      category: 'UI/UX Design',
      tags: ['Figma', 'Design Systems', 'UI Design', 'UX Research', 'Prototyping'],
      packages: [
        {
          name: 'basic',
          title: 'Landing Page Design',
          description: 'Single landing page design with Figma prototype',
          price: 300,
          deliveryDays: 5,
          revisions: 2,
          features: ['Wireframes', 'High-Fidelity Design', 'Prototype', 'Desktop + Mobile'],
        },
        {
          name: 'standard',
          title: 'Web App UI Kit',
          description: 'Complete UI kit for web application',
          price: 800,
          deliveryDays: 14,
          revisions: 3,
          features: ['Design System', '50+ Components', 'Mobile Responsive', 'Developer Handoff'],
        },
        {
          name: 'premium',
          title: 'Full Product Design',
          description: 'Complete product design from research to handoff',
          price: 2500,
          deliveryDays: 30,
          revisions: 5,
          features: ['User Research', 'Information Architecture', 'Design System', 'Prototype + Testing', 'Developer Handoff'],
        },
      ],
    },
    {
      seller: freelancers[2], // Muhammad Hassan
      title: 'Machine Learning & Data Science Projects',
      description: 'Build custom ML models, data pipelines, and AI solutions. From problem definition to deployment.',
      category: 'Data Science / AI',
      tags: ['Python', 'Machine Learning', 'TensorFlow', 'Data Analysis', 'NLP'],
      packages: [
        {
          name: 'basic',
          title: 'Data Analysis Report',
          description: 'In-depth analysis of your data with visualizations',
          price: 400,
          deliveryDays: 7,
          revisions: 2,
          features: ['Data Exploration', 'Statistical Analysis', 'Visualizations', 'Insights Report'],
        },
        {
          name: 'standard',
          title: 'ML Model Development',
          description: 'Build and train machine learning model',
          price: 1200,
          deliveryDays: 14,
          revisions: 3,
          features: ['Data Preprocessing', 'Model Training', 'Evaluation Metrics', 'API Integration'],
        },
        {
          name: 'premium',
          title: 'End-to-End AI Solution',
          description: 'Complete ML pipeline from data to production deployment',
          price: 3500,
          deliveryDays: 30,
          revisions: 5,
          features: ['Data Pipeline', 'Model Development', 'Optimization', 'Deployment', 'Monitoring'],
        },
      ],
    },
    {
      seller: freelancers[3], // Fatima Aziz
      title: 'React Native Mobile App Development',
      description: 'Build high-performance cross-platform mobile apps using React Native. iOS and Android from single codebase.',
      category: 'Mobile Development',
      tags: ['React Native', 'iOS', 'Android', 'Firebase', 'Cross-Platform'],
      packages: [
        {
          name: 'basic',
          title: 'Simple Mobile App',
          description: 'Basic mobile app with 3-5 screens',
          price: 600,
          deliveryDays: 10,
          revisions: 2,
          features: ['Native UI Components', 'Navigation', 'Local Storage', 'iOS & Android'],
        },
        {
          name: 'standard',
          title: 'Feature-Rich App',
          description: 'App with backend integration and real-time features',
          price: 1800,
          deliveryDays: 21,
          revisions: 4,
          features: ['Backend Integration', 'Authentication', 'Push Notifications', 'Offline Support'],
        },
        {
          name: 'premium',
          title: 'Enterprise App',
          description: 'Production-ready app with advanced features and support',
          price: 4000,
          deliveryDays: 45,
          revisions: 6,
          features: ['Advanced Security', 'Analytics Integration', 'App Store Submission', 'Support & Updates'],
        },
      ],
    },
    {
      seller: freelancers[4], // Ali Raza
      title: 'DevOps & Cloud Infrastructure',
      description: 'AWS Setup, CI/CD pipelines, Docker, Kubernetes, and infrastructure as code. Keep your systems running smoothly.',
      category: 'DevOps & Cloud',
      tags: ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform'],
      packages: [
        {
          name: 'basic',
          title: 'Basic Cloud Setup',
          description: 'EC2 instance setup with basic configuration',
          price: 250,
          deliveryDays: 3,
          revisions: 1,
          features: ['EC2 Setup', 'Security Groups', 'RDS Database', 'Basic Monitoring'],
        },
        {
          name: 'standard',
          title: 'CI/CD Pipeline Setup',
          description: 'Complete automation pipeline with GitHub Actions or Jenkins',
          price: 800,
          deliveryDays: 7,
          revisions: 2,
          features: ['GitHub Actions Setup', 'Automated Tests', 'Docker Build', 'Deployment Automation'],
        },
        {
          name: 'premium',
          title: 'Enterprise Infrastructure',
          description: 'Full-scale infrastructure with Kubernetes and observability',
          price: 2500,
          deliveryDays: 14,
          revisions: 4,
          features: ['Kubernetes Cluster', 'Service Mesh', 'Monitoring & Logging', 'Infrastructure as Code', 'Security Hardening'],
        },
      ],
    },
    {
      seller: freelancers[5], // Noor Sheikh
      title: 'SEO Optimization & Content Strategy',
      description: 'Boost your online visibility with professional SEO and content marketing strategies.',
      category: 'Digital Marketing',
      tags: ['SEO', 'Content Writing', 'Keyword Research', 'On-Page SEO'],
      packages: [
        {
          name: 'basic',
          title: 'SEO Audit',
          description: 'Complete website SEO audit with recommendations',
          price: 250,
          deliveryDays: 5,
          revisions: 1,
          features: ['Technical SEO Audit', 'Keyword Analysis', 'Competitor Analysis', 'Improvement Roadmap'],
        },
        {
          name: 'standard',
          title: 'SEO Optimization Package',
          description: 'On-page SEO optimization and content optimization',
          price: 600,
          deliveryDays: 10,
          revisions: 2,
          features: ['On-Page SEO', 'Meta Tags Optimization', 'Content Improvement', 'Internal Linking'],
        },
        {
          name: 'premium',
          title: 'Full SEO Strategy',
          description: 'Comprehensive SEO strategy with ongoing optimization',
          price: 1500,
          deliveryDays: 30,
          revisions: 4,
          features: ['Keyword Strategy', 'Content Calendar', 'Backlink Strategy', 'Monthly Monitoring'],
        },
      ],
    },
  ];

  for (const offer of offerTemplates) {
    await Offer.findOneAndUpdate(
      {
        seller: offer.seller,
        title: offer.title,
      },
      {
        $set: {
          ...offer,
          status: 'active',
          isApproved: true,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
  }
  console.log(`✅ Seeded ${offerTemplates.length} offers`);

  console.log('✅ All done! Jobs and offers have been permanently seeded.');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('❌ Failed to seed:', err.message);
  try {
    await mongoose.connection.close();
  } catch { }
  process.exit(1);
});
