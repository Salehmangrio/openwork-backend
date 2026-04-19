/**
 * Notification System Test Suite
 * Tests all notification endpoints, services, and preferences
 * Run: npm test -- notifications.test.js
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const { Notification, User } = require('../models/index');
const jwt = require('jsonwebtoken');

let authToken = '';
let testUserId = '';
let otherUserId = '';
let notificationId = '';

// ═══════════════════════════════════════════════════════════════════════════
// SETUP & TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════

beforeAll(async () => {
  // Connect to test database
  const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://mongodb:27017/openwork-test';
  try {
    await mongoose.connect(mongoUri);
  } catch (e) {
    console.warn('Using existing MongoDB connection');
  }

  // Create test users
  testUserId = new mongoose.Types.ObjectId();
  otherUserId = new mongoose.Types.ObjectId();

  // Create auth token
  authToken = jwt.sign(
    { _id: testUserId, email: 'testuser@openwork.io', role: 'freelancer' },
    process.env.JWT_SECRET || 'test-secret'
  );
});

afterAll(async () => {
  await Notification.deleteMany({});
  await mongoose.disconnect();
});

afterEach(async () => {
  // Clean up notifications after each test
  await Notification.deleteMany({ recipient: testUserId });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/notifications', () => {
  beforeEach(async () => {
    // Create test notifications
    await Notification.create([
      {
        recipient: testUserId,
        type: 'order_created',
        title: 'New Order',
        message: 'You received a new order',
        category: 'order',
        isRead: false,
      },
      {
        recipient: testUserId,
        type: 'job_match',
        title: 'Job Match Found',
        message: 'A job matches your skills',
        category: 'system',
        isRead: true,
        readAt: new Date(),
      },
    ]);
  });

  it('should fetch all notifications for authenticated user', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notifications.length).toBeGreaterThan(0);
    expect(res.body.unreadCount).toBeDefined();
  });

  it('should filter unread notifications', async () => {
    const res = await request(app)
      .get('/api/notifications?filter=unread')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications.every(n => !n.isRead)).toBe(true);
  });

  it('should filter read notifications', async () => {
    const res = await request(app)
      .get('/api/notifications?filter=read')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications.every(n => n.isRead)).toBe(true);
  });

  it('should support pagination', async () => {
    const res = await request(app)
      .get('/api/notifications?page=1&limit=10')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(10);
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/notifications');

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MARK AS READ
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/notifications/:id/read', () => {
  beforeEach(async () => {
    const notif = await Notification.create({
      recipient: testUserId,
      type: 'order_created',
      title: 'Test Notification',
      message: 'Test message',
      category: 'order',
      isRead: false,
    });
    notificationId = notif._id;
  });

  it('should mark single notification as read', async () => {
    const res = await request(app)
      .put(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notification.isRead).toBe(true);
    expect(res.body.notification.readAt).toBeDefined();
  });

  it('should not allow marking others notifications', async () => {
    const otherToken = jwt.sign(
      { _id: otherUserId, email: 'other@openwork.io' },
      process.env.JWT_SECRET || 'test-secret'
    );

    const res = await request(app)
      .put(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MARK ALL AS READ
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/notifications/all/read', () => {
  beforeEach(async () => {
    await Notification.create([
      {
        recipient: testUserId,
        type: 'order_created',
        title: 'Notif 1',
        message: 'Message 1',
        category: 'order',
        isRead: false,
      },
      {
        recipient: testUserId,
        type: 'job_match',
        title: 'Notif 2',
        message: 'Message 2',
        category: 'system',
        isRead: false,
      },
    ]);
  });

  it('should mark all unread notifications as read', async () => {
    const res = await request(app)
      .put('/api/notifications/all/read')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.modifiedCount).toBeGreaterThan(0);

    // Verify all are marked as read
    const notifs = await Notification.find({ recipient: testUserId });
    expect(notifs.every(n => n.isRead)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /api/notifications/:id', () => {
  beforeEach(async () => {
    const notif = await Notification.create({
      recipient: testUserId,
      type: 'order_created',
      title: 'To Delete',
      message: 'Delete me',
      category: 'order',
      isRead: false,
    });
    notificationId = notif._id;
  });

  it('should delete a notification', async () => {
    const res = await request(app)
      .delete(`/api/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify deletion
    const notif = await Notification.findById(notificationId);
    expect(notif).toBeNull();
  });

  it('should not allow deleting others notifications', async () => {
    const otherToken = jwt.sign(
      { _id: otherUserId, email: 'other@openwork.io' },
      process.env.JWT_SECRET || 'test-secret'
    );

    const res = await request(app)
      .delete(`/api/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE ALL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /api/notifications', () => {
  beforeEach(async () => {
    await Notification.create([
      {
        recipient: testUserId,
        type: 'order_created',
        title: 'Notif 1',
        message: 'Message 1',
        category: 'order',
        isRead: false,
      },
      {
        recipient: testUserId,
        type: 'job_match',
        title: 'Notif 2',
        message: 'Message 2',
        category: 'system',
        isRead: false,
      },
    ]);
  });

  it('should delete all notifications for user', async () => {
    const res = await request(app)
      .delete('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deletedCount).toBeGreaterThan(0);

    // Verify deletion
    const count = await Notification.countDocuments({ recipient: testUserId });
    expect(count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/notifications/preferences', () => {
  it('should fetch user notification preferences', async () => {
    const res = await request(app)
      .get('/api/notifications/preferences')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preferences).toBeDefined();
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/notifications/preferences');

    expect(res.status).toBe(401);
  });
});

describe('PUT /api/notifications/preferences', () => {
  it('should update user notification preferences', async () => {
    const newPrefs = {
      messages: false,
      jobMatches: true,
      payments: true,
      disputes: true,
      marketing: false,
    };

    const res = await request(app)
      .put('/api/notifications/preferences')
      .set('Authorization', `Bearer ${authToken}`)
      .send(newPrefs);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preferences.messages).toBe(false);
  });

  it('should require authentication', async () => {
    const res = await request(app)
      .put('/api/notifications/preferences')
      .send({ messages: false });

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/notifications/stats', () => {
  beforeEach(async () => {
    await Notification.create([
      {
        recipient: testUserId,
        type: 'order_created',
        title: 'Order 1',
        message: 'Message 1',
        category: 'order',
        isRead: false,
      },
      {
        recipient: testUserId,
        type: 'job_match',
        title: 'Job 1',
        message: 'Message 2',
        category: 'system',
        isRead: false,
      },
      {
        recipient: testUserId,
        type: 'order_completed',
        title: 'Order 2',
        message: 'Message 3',
        category: 'order',
        isRead: true,
      },
    ]);
  });

  it('should fetch notification statistics', async () => {
    const res = await request(app)
      .get('/api/notifications/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats.total).toBeGreaterThan(0);
    expect(res.body.stats.unread).toBeGreaterThan(0);
    expect(res.body.stats.byCategory).toBeDefined();
    expect(res.body.stats.byType).toBeDefined();
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/notifications/stats');

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Notification Schema Validation', () => {
  it('should validate required fields', async () => {
    const invalidNotif = {
      recipient: testUserId,
      // missing type, title, message
    };

    const res = Notification(invalidNotif);
    const error = res.validateSync();
    expect(error).toBeDefined();
  });

  it('should validate notification type enum', async () => {
    const invalidNotif = {
      recipient: testUserId,
      type: 'invalid_type',
      title: 'Test',
      message: 'Test',
    };

    try {
      await Notification.create(invalidNotif);
      expect(true).toBe(false); // Should have thrown
    } catch (err) {
      expect(err.name).toBe('ValidationError');
    }
  });

  it('should save sender as optional field', async () => {
    const notif = await Notification.create({
      recipient: testUserId,
      sender: otherUserId,
      type: 'order_created',
      title: 'Test',
      message: 'Test',
      category: 'order',
    });

    expect(notif.sender.toString()).toBe(otherUserId.toString());
  });

  it('should save category field', async () => {
    const notif = await Notification.create({
      recipient: testUserId,
      type: 'order_created',
      title: 'Test',
      message: 'Test',
      category: 'order',
    });

    expect(notif.category).toBe('order');
  });
});
