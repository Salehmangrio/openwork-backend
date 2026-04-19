const { validationResult } = require('express-validator');

exports.handleValidation = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: result.array().map((e) => ({ field: e.path, message: e.msg })),
  });
};
