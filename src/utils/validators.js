/**
 * utils/validators.js
 * Validation helper utilities for common data types
 */

const mongoose = require('mongoose');

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
exports.validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (international format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format (10-15 digits)
 */
exports.validatePhoneNumber = (phone) => {
  const phoneRegex = /^\+?[\d\s\-()]{10,15}$/;
  return phoneRegex.test(phone?.replace(/\s+/g, ''));
};

/**
 * Validate password strength
 * Requires: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
 * @param {string} password - Password to validate
 * @returns {boolean} True if password meets requirements
 */
exports.validatePassword = (password) => {
  if (!password || password.length < 8) return false;
  
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  return hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
exports.validateURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Validate money amount (positive number with max 2 decimals)
 * @param {number} amount - Amount to validate
 * @param {number} max - Maximum allowed amount (optional)
 * @returns {boolean} True if valid money amount
 */
exports.validateMoneyAmount = (amount, max = 999999.99) => {
  if (typeof amount !== 'number' || amount < 0 || amount > max) return false;
  const decimals = amount.toString().split('.')[1];
  return !decimals || decimals.length <= 2;
};

/**
 * Validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid ObjectId
 */
exports.isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validate array of MongoDB ObjectIds
 * @param {array} ids - Array of IDs to validate
 * @returns {boolean} True if all are valid ObjectIds
 */
exports.isValidObjectIdArray = (ids) => {
  if (!Array.isArray(ids)) return false;
  return ids.every(id => mongoose.Types.ObjectId.isValid(id));
};

/**
 * Validate string is not empty (after trim)
 * @param {string} str - String to validate
 * @param {number} minLength - Minimum length (default 1)
 * @returns {boolean} True if valid non-empty string
 */
exports.isValidString = (str, minLength = 1) => {
  return typeof str === 'string' && str.trim().length >= minLength;
};

/**
 * Validate array is not empty
 * @param {array} arr - Array to validate
 * @returns {boolean} True if valid non-empty array
 */
exports.isValidArray = (arr) => {
  return Array.isArray(arr) && arr.length > 0;
};

/**
 * Validate enum value
 * @param {string} value - Value to validate
 * @param {array} enumValues - Array of allowed values
 * @returns {boolean} True if value is in enum
 */
exports.isValidEnum = (value, enumValues) => {
  return enumValues.includes(value);
};

/**
 * Validate date is in future
 * @param {Date} date - Date to validate
 * @returns {boolean} True if date is in future
 */
exports.isFutureDate = (date) => {
  return new Date(date) > new Date();
};

/**
 * Validate date is in past
 * @param {Date} date - Date to validate
 * @returns {boolean} True if date is in past
 */
exports.isPastDate = (date) => {
  return new Date(date) < new Date();
};

/**
 * Validate range (number between min and max)
 * @param {number} value - Value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {boolean} True if value is in range
 */
exports.isInRange = (value, min, max) => {
  return typeof value === 'number' && value >= min && value <= max;
};

/**
 * Validate skills array
 * @param {array} skills - Array of skill strings
 * @param {number} maxSkills - Maximum number of skills (default 20)
 * @returns {boolean} True if valid skills array
 */
exports.isValidSkillsArray = (skills, maxSkills = 20) => {
  if (!Array.isArray(skills) || skills.length === 0) return false;
  if (skills.length > maxSkills) return false;
  return skills.every(skill => typeof skill === 'string' && skill.trim().length > 0);
};
