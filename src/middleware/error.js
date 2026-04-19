/**
 * middleware/error.js
 * Centralized error handling middleware
 * Catches and formats all errors consistently
 */

class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * Async wrapper to catch errors in async route handlers
 * Usage: router.get('/', asyncHandler(controller.getJobs));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Global error handling middleware
 * Should be used LAST in middleware chain
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = `Invalid Data / ${Object.keys(err.errors)[0]}`;
    err = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    err = new AppError(message, 400, 'DUPLICATE_ENTRY');
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    err = new AppError(message, 401, 'INVALID_TOKEN');
  }

  // JWT expired error
  if (err.name === 'TokenExpiredError') {
    const message = 'Token has expired';
    err = new AppError(message, 401, 'TOKEN_EXPIRED');
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    err = new AppError(message, 400, 'INVALID_ID');
  }

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('ERROR:', err);
  }

  res.status(err.statusCode).json({
    success: false,
    message: err.message,
    errorCode: err.errorCode || 'UNKNOWN_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
};
