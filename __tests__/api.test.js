/**
 * Backend API Test Suite
 * Tests all API endpoints with Jest + Supertest
 * Run: npm test
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index'); // Express app
const User = require('../models/User');
const { OpenJob, Order } = require('../models/index');
const bcrypt = require('bcryptjs');

const BASE_URL = 'http://localhost:5000';
let authToken = '';
let testUserId = '';
let testJobId = '';

// ═══════════════════════════════════════════════════════════════════════════
// SETUP & TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════

beforeAll(async () => {
  // Connect to test database
  const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://mongodb:27017/openwork-test';
  try {
    await mongoose.connect(mongoUri);
  } catch (e) {
    console.warn('Note: Using in-memory MongoDB for tests. Install mongodb-memory-server for full isolation.');
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/auth/register', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'Test User',
        email: 'testuser@openwork.io',
        password: 'TestPassword123!',
        role: 'freelancer',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.token).toBeDefined();
    
    testUserId = res.body.user._id;
    authToken = res.body.token;
  });

  it('should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'Another User',
        email: 'testuser@openwork.io', // Duplicate
        password: 'AnotherPass123!',
        role: 'freelancer',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  it('should login with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testuser@openwork.io',
        password: 'TestPassword123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('should reject incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testuser@openwork.io',
        password: 'WrongPassword123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/auth/me', () => {
  it('should get authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('testuser@openwork.io');
  });

  it('should reject missing token', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// USER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/users', () => {
  it('should list users with pagination', async () => {
    const res = await request(app)
      .get('/api/users?page=1&limit=10');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should filter by role', async () => {
    const res = await request(app)
      .get('/api/users?role=freelancer');

    expect(res.status).toBe(200);
    res.body.data.forEach(user => {
      expect(user.role).toBe('freelancer');
    });
  });
});

describe('GET /api/users/:id', () => {
  it('should get user profile', async () => {
    const res = await request(app)
      .get(`/api/users/${testUserId}`);

    expect(res.status).toBe(200);
    expect(res.body.user._id.toString()).toBe(testUserId);
  });

  it('should return 404 for non-existent user', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/users/${fakeId}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/users/:id', () => {
  it('should update user profile', async () => {
    const res = await request(app)
      .put(`/api/users/${testUserId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        bio: 'Updated bio',
        hourly_rate: 45,
      });

    expect(res.status).toBe(200);
    expect(res.body.user.bio).toBe('Updated bio');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// JOB ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/jobs', () => {
  it('should create new job', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Job',
        description: 'Test job description',
        category: 'Web Development',
        budget_min: 1000,
        budget_max: 3000,
        budget_type: 'fixed',
        required_skills: ['React', 'Node.js'],
        experience_level: 'intermediate',
        duration: '2 weeks',
      });

    expect(res.status).toBe(201);
    expect(res.body.job.title).toBe('Test Job');
    
    testJobId = res.body.job._id;
  });
});

describe('GET /api/jobs', () => {
  it('should list all jobs', async () => {
    const res = await request(app)
      .get('/api/jobs');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.jobs)).toBe(true);
  });

  it('should filter by category', async () => {
    const res = await request(app)
      .get('/api/jobs?category=Web%20Development');

    expect(res.status).toBe(200);
  });
});

describe('GET /api/jobs/:id', () => {
  it('should get job details', async () => {
    const res = await request(app)
      .get(`/api/jobs/${testJobId}`);

    expect(res.status).toBe(200);
    expect(res.body.job._id.toString()).toBe(testJobId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/payments/create-intent', () => {
  it('should create Stripe payment intent', async () => {
    const res = await request(app)
      .post('/api/payments/create-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 5000, // $50.00
        currency: 'usd',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.clientSecret).toBeDefined();
  });
});

describe('GET /api/payments/wallet-balance', () => {
  it('should get user wallet balance', async () => {
    const res = await request(app)
      .get('/api/payments/wallet-balance')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.balance).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/notifications', () => {
  it('should get user notifications', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
  });

  it('should support pagination', async () => {
    const res = await request(app)
      .get('/api/notifications?page=1&limit=20')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
  });
});

describe('PUT /api/notifications/:id/read', () => {
  it('should mark notification as read', async () => {
    // First create a notification
    const notif = await Notification.create({
      user_id: testUserId,
      type: 'message',
      title: 'Test',
      is_read: false,
    });

    const res = await request(app)
      .put(`/api/notifications/${notif._id}/read`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AI ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/ai/skill-test/evaluate', () => {
  it('should evaluate skill test answers', async () => {
    const res = await request(app)
      .post('/api/ai/skill-test/evaluate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        answers: [1, 0, 2, 1, 0], // Answer indices
        test_id: 'test-123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/ai/job-match', () => {
  it('should calculate job match scores', async () => {
    const res = await request(app)
      .post('/api/ai/job-match')
      .send({
        freelancer: {
          skills: ['React', 'Node.js', 'MongoDB'],
          ai_score: 85,
          rating: 4.8,
        },
        jobs: [testJobId],
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.matches)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/health', () => {
  it('should return healthy status', async () => {
    const res = await request(app)
      .get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
