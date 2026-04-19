/**
 * controllers/index.js
 * Main controller index file - controllers have been organized by feature
 * 
 * MIGRATION COMPLETE: All controllers have been split into dedicated files
 * organized by business domain following Single Responsibility Principle
 */

// Re-export all controllers for backward compatibility if needed
// But routes should import directly from specific controller files

module.exports = {
  // Job Management
  ...require('./jobController'),
  
  // Offer Management
  ...require('./offerController'),
  
  // Proposal Management
  ...require('./proposalController'),
  
  // Order Management
  ...require('./orderController'),
  
  // Payment Management
  ...require('./paymentController'),
  ...require('./paymentMethodController'),
  
  // Review & Ratings
  ...require('./reviewController'),
  
  // Disputes
  ...require('./disputeController'),
  
  // Notifications
  ...require('./notificationController'),
  
  // Admin
  ...require('./adminController'),
  
  // User Dashboard
  ...require('./dashboardController'),
  
  // AI Features
  ...require('./aiController'),
  
  // User Management
  ...require('./userController'),
  
  // Skill Tests
  ...require('./skillTestController'),
  
  // Messages
  ...require('./messageController'),
  
  // Authentication
  ...require('./authController'),
};

/**
 * CONTROLLER ARCHITECTURE
 * 
 * Each controller file handles a specific business domain and follows these patterns:
 * 
 * 1. **jobController.js**
 *    - Job creation, updating, deletion
 *    - Job listing with filters
 *    - Job status management (pause, close)
 *    - Integrates: jobService
 * 
 * 2. **offerController.js**
 *    - Offer creation and management
 *    - Offer purchase and stats
 *    - Integrates: offerService
 * 
 * 3. **proposalController.js**
 *    - Proposal submission and management
 *    - Proposal acceptance/rejection flow
 *    - Integrates: proposalService
 * 
 * 4. **orderController.js**
 *    - Order creation and management
 *    - OrderStatus updates and delivery
 *    - Milestone/payment release
 *    - Integrates: orderService
 * 
 * 5. **paymentController.js**
 *    - Payment intent creation (Stripe)
 *    - Payment confirmation
 *    - Withdrawal requests
 *    - Webhook handling
 *    - Integrates: paymentService
 * 
 * 6. **reviewController.js**
 *    - Review creation
 *    - Review retrieval and updates
 *    - Integrates: reviewService
 * 
 * 7. **disputeController.js**
 *    - Dispute creation and management
 *    - Dispute resolution
 *    - Messages and mediator assignment
 *    - Integrates: disputeService
 * 
 * 8. **notificationController.js**
 *    - Notification retrieval
 *    - Mark as read/unread
 *    - Notification preferences
 *    - Integrates: notificationService
 * 
 * 9. **adminController.js**
 *    - Dashboard stats
 *    - User management
 *    - Dispute management
 *    - Activity logs
 *    - Analytics and health metrics
 *    - Integrates: adminService
 * 
 * 10. **dashboardController.js**
 *     - Freelancer dashboard
 *     - Client dashboard
 *     - Performance metrics
 *     - Earnings breakdown
 *     - Integrates: dashboardService
 * 
 * 11. **aiController.js**
 *     - Proposal generation (Claude API)
 *     - Job matching scores
 *     - Job recommendations
 *     - AI chat assistant
 *     - Profile analysis
 *     - Learning recommendations
 *     - Integrates: aiService
 * 
 * 12. **userController.js**
 *     - User profile (public/private)
 *     - Freelancer directory
 *     - Profile updates
 *     - Dashboard statistics
 *     - Integrates: userService
 * 
 * 13. **skillTestController.js**
 *     - Skill test generation
 *     - Test evaluation
 *     - Certification management
 *     - Integrates: skillTestService
 * 
 * 14. **messageController.js** (Existing)
 *     - Message and conversation management
 *     - Real-time chat via Socket.io
 * 
 * 15. **authController.js** (Existing)
 *     - Authentication (login, signup, logout)
 *     - Token management
 * 
 * 16. **aiProxyController.js** (Existing)
 *     - Legacy AI endpoints (being phased out in favor of aiController)
 */

/**
 * SERVICE LAYER ORGANIZATION
 * 
 * Services are the business logic layer. Each service corresponds to a controller domain.
 * 
 * Services follow these patterns:
 * - All database operations use transactions where needed for data consistency
 * - Cascade updates are handled atomically
 * - All methods return {success: true/false, data: ..., error: ...}
 * - Error handling and logging is centralized
 * - Notifications are sent via notificationService
 * - Activity logging is done via logActivity helper
 * 
 * Key Services:
 * - jobService: Job CRUD, matching, notifications
 * - proposalService: Proposal lifecycle with order creation on acceptance
 * - orderService: Order management with payment handling
 * - paymentService: Stripe integration, escrow, wallets
 * - offerService: Offer marketplace operations
 * - reviewService: Reviews with average rating recalculation
 * - disputeService: Dispute resolution with refunds
 * - notificationService: Notification delivery and preferences
 * - adminService: Admin operations, analytics, user management
 * - dashboardService: Statistics generation
 * - aiService: Claude API integration for AI features
 * - userService: User profile and statistics
 * - skillTestService: Skill testing integration with Python ML service
 */
