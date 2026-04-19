/**
 * middleware/logging.js
 * Request/response logging middleware
 * Tracks API usage and errors
 */

/**
 * Simple request logger middleware
 * Logs method, path, IP, status code
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.path} | ${res.statusCode} | ${duration}ms | IP: ${req.ip}`;

    if (res.statusCode >= 400) {
      console.error(`❌ ${message}`);
    } else if (res.statusCode >= 300) {
      console.warn(`⚠️  ${message}`);
    } else {
      console.log(`✓ ${message}`);
    }
  });

  next();
};

/**
 * User action logger middleware
 * Logs user-specific actions for audit trail
 */
const userActionLogger = (action) => {
  return (req, res, next) => {
    res.on('finish', () => {
      if (req.user && res.statusCode < 400) {
        const logData = {
          action,
          userId: req.user._id,
          userEmail: req.user.email,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          timestamp: new Date(),
          ip: req.ip,
        };
        console.log(`📝 USER ACTION:`, logData);
      }
    });
    next();
  };
};

module.exports = {
  requestLogger,
  userActionLogger,
};
