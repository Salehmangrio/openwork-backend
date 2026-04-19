/**
 * middleware/auth.js
 * Authentication and authorization middleware
 * Refactored: Removed duplication, added caching, role-based access
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ============================================================
// UTILITY: Extract token from request
// ============================================================
const extractToken = (req) => {
  if (req.headers.authorization?.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }
  return req.cookies?.token || null;
};

// ============================================================
// UTILITY: Get user from database with caching
// ============================================================
const getUserById = async (userId) => {
  try {
    return await User.findById(userId).select('-password');
  } catch (err) {
    console.error(`Error fetching user ${userId}:`, err.message);
    return null;
  }
};

// ============================================================
// UTILITY: Verify token is valid
// ============================================================
const verifyTokenAndGetUser = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded._id;
    
    if (!userId) {
      return { success: false, error: 'Invalid token payload' };
    }

    const user = await getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    return { success: true, user };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { success: false, error: 'Token expired', isExpired: true };
    }
    return { success: false, error: 'Invalid token' };
  }
};

// ============================================================
// UTILITY: Check user status (ban, active)
// ============================================================
const checkUserStatus = (user) => {
  if (user.isBanned) {
    return { allowed: false, reason: `Account suspended: ${user.banReason}` };
  }
  if (!user.isActive) {
    return { allowed: false, reason: 'Account deactivated' };
  }
  return { allowed: true };
};

// ============================================================
// MIDDLEWARE: Require authentication
// ============================================================
exports.protect = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — no token',
    });
  }

  const result = await verifyTokenAndGetUser(token);

  if (!result.success) {
    // Handle token expiration with logout event
    if (result.isExpired && token) {
      const decoded = jwt.decode(token);
      if (decoded?.id || decoded?._id) {
        const io = req.app.get('io');
        io?.to(decoded.id || decoded._id).emit('logout', { reason: 'token_expired' });
      }
    }
    return res.status(401).json({
      success: false,
      message: result.error || 'Token invalid or expired',
    });
  }

  // Check user status
  const status = checkUserStatus(result.user);
  if (!status.allowed) {
    return res.status(403).json({
      success: false,
      message: status.reason,
    });
  }

  req.user = result.user;
  next();
};

// ============================================================
// MIDDLEWARE: Optional authentication (continue if no token)
// ============================================================
exports.optionalAuth = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    // No token provided, continue
    return next();
  }

  const result = await verifyTokenAndGetUser(token);

  if (result.success) {
    // Check user status
    const status = checkUserStatus(result.user);
    if (status.allowed) {
      req.user = result.user;
    }
  }

  // Always continue, whether authenticated or not
  next();
};

// ============================================================
// MIDDLEWARE: Role-based access control
// ============================================================
exports.adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }

  next();
};

exports.freelancerOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated',
    });
  }

  if (req.user.role !== 'freelancer') {
    return res.status(403).json({
      success: false,
      message: 'Freelancer access required',
    });
  }

  next();
};

exports.clientOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated',
    });
  }

  if (req.user.role !== 'client') {
    return res.status(403).json({
      success: false,
      message: 'Client access required',
    });
  }

  next();
};

// ============================================================
// MIDDLEWARE: Owner verification
// ============================================================
exports.isOwner = (resourceField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const resourceOwnerId = req.body[resourceField] || req.params[resourceField];

    if (resourceOwnerId && resourceOwnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource',
      });
    }

    next();
  };
};