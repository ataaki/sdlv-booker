/**
 * Validation Utilities
 *
 * Centralized validation logic for booking rules and user inputs.
 * Provides consistent error messages across the application.
 */

const { VALID_DURATIONS, PLAYGROUNDS } = require('../constants');

/**
 * Core validation functions (return boolean)
 */
const validators = {
  /**
   * Check if time string is in HH:MM format
   * @param {string} time - Time string to validate
   * @returns {boolean} True if valid
   */
  isValidTimeFormat(time) {
    return /^\d{2}:\d{2}$/.test(time);
  },

  /**
   * Check if duration is one of the valid values (60, 90, 120)
   * @param {number|string} duration - Duration to validate
   * @returns {boolean} True if valid
   */
  isValidDuration(duration) {
    return VALID_DURATIONS.includes(parseInt(duration));
  },

  /**
   * Check if day of week is valid (0-6, where 0=Sunday)
   * @param {number} day - Day of week to validate
   * @returns {boolean} True if valid
   */
  isValidDayOfWeek(day) {
    return day >= 0 && day <= 6;
  },

  /**
   * Check if playground name exists
   * @param {string} name - Playground name to validate
   * @returns {boolean} True if valid
   */
  isValidPlayground(name) {
    return Object.keys(PLAYGROUNDS).includes(name);
  },

  /**
   * Check if email format is valid
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  /**
   * Check if date is in YYYY-MM-DD format
   * @param {string} date - Date to validate
   * @returns {boolean} True if valid
   */
  isValidDateFormat(date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
  },
};

/**
 * Validation functions that return error message or null
 */

/**
 * Validate time format (HH:MM)
 * @param {string} time - Time to validate
 * @returns {string|null} Error message or null if valid
 */
function validateTimeFormat(time) {
  if (!time) {
    return 'time is required';
  }
  if (!validators.isValidTimeFormat(time)) {
    return 'time must be in HH:MM format';
  }
  return null;
}

/**
 * Validate duration (60, 90, or 120 minutes)
 * @param {number|string} duration - Duration to validate
 * @returns {string|null} Error message or null if valid
 */
function validateDuration(duration) {
  if (duration && !validators.isValidDuration(duration)) {
    return `duration must be one of: ${VALID_DURATIONS.join(', ')}`;
  }
  return null;
}

/**
 * Validate day of week (0-6)
 * @param {number} day - Day of week to validate
 * @returns {string|null} Error message or null if valid
 */
function validateDayOfWeek(day) {
  if (day === undefined || day === null) {
    return 'day_of_week is required';
  }
  if (!validators.isValidDayOfWeek(day)) {
    return 'day_of_week must be 0-6 (0=Dimanche)';
  }
  return null;
}

/**
 * Validate playground name
 * @param {string} name - Playground name to validate
 * @returns {string|null} Error message or null if valid
 */
function validatePlayground(name) {
  if (!name) {
    return 'playground name is required';
  }
  if (!validators.isValidPlayground(name)) {
    return `Unknown playground: ${name}. Valid playgrounds: ${Object.keys(PLAYGROUNDS).join(', ')}`;
  }
  return null;
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {string|null} Error message or null if valid
 */
function validateEmail(email) {
  if (!email) {
    return 'email is required';
  }
  if (!validators.isValidEmail(email)) {
    return 'invalid email format';
  }
  return null;
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} date - Date to validate
 * @returns {string|null} Error message or null if valid
 */
function validateDateFormat(date) {
  if (!date) {
    return 'date is required';
  }
  if (!validators.isValidDateFormat(date)) {
    return 'date must be in YYYY-MM-DD format';
  }
  return null;
}

/**
 * Validate booking advance days setting (1-90)
 * @param {number} days - Days to validate
 * @returns {string|null} Error message or null if valid
 */
function validateBookingAdvanceDays(days) {
  const val = parseInt(days);
  if (isNaN(val) || val < 1 || val > 90) {
    return 'booking_advance_days doit être entre 1 et 90';
  }
  return null;
}

/**
 * Validate a complete booking rule
 * @param {object} rule - Rule object to validate
 * @param {number} rule.day_of_week - Day of week (0-6)
 * @param {string} rule.target_time - Target time (HH:MM)
 * @param {number} [rule.duration] - Duration in minutes
 * @returns {string[]} Array of error messages (empty if valid)
 */
function validateBookingRule({ day_of_week, target_time, duration }) {
  const errors = [];

  if (day_of_week === undefined || day_of_week === null) {
    errors.push('day_of_week is required');
  } else {
    const dayError = validateDayOfWeek(day_of_week);
    if (dayError) errors.push(dayError);
  }

  if (!target_time) {
    errors.push('target_time is required');
  } else {
    const timeError = validateTimeFormat(target_time);
    if (timeError) errors.push(timeError);
  }

  if (duration) {
    const durationError = validateDuration(duration);
    if (durationError) errors.push(durationError);
  }

  return errors;
}

module.exports = {
  validators,
  validateTimeFormat,
  validateDuration,
  validateDayOfWeek,
  validatePlayground,
  validateEmail,
  validateDateFormat,
  validateBookingAdvanceDays,
  validateBookingRule,
};
