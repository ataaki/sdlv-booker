/**
 * Error Handler Middleware
 *
 * Provides consistent error response formatting across all API routes.
 * Ensures all errors are properly logged and returned in a standard format.
 */

/**
 * Centralized error response handler
 *
 * Use this to handle errors in route handlers with consistent formatting.
 *
 * @param {Error|string} err - Error object or message
 * @param {object} res - Express response object
 * @param {number} [statusCode=500] - HTTP status code
 * @returns {object} Express response
 *
 * @example
 * try {
 *   await someOperation();
 * } catch (err) {
 *   return errorHandler(err, res, 500);
 * }
 */
function errorHandler(err, res, statusCode = 500) {
  const message = err?.message || String(err) || 'Une erreur interne est survenue';
  console.error(`[Error] ${statusCode}:`, message);

  return res.status(statusCode).json({ error: message });
}

/**
 * Validation error handler
 *
 * Use this for validation errors (bad user input).
 *
 * @param {object} res - Express response object
 * @param {string} message - Validation error message
 * @param {number} [statusCode=400] - HTTP status code (defaults to 400 Bad Request)
 * @returns {object} Express response
 *
 * @example
 * if (!email) {
 *   return validationError(res, 'Email is required');
 * }
 */
function validationError(res, message, statusCode = 400) {
  console.warn(`[Validation] ${statusCode}:`, message);
  return res.status(statusCode).json({ error: message });
}

/**
 * Not found error handler
 *
 * Use this for resource not found errors.
 *
 * @param {object} res - Express response object
 * @param {string} [resource='Resource'] - Name of the resource
 * @returns {object} Express response
 *
 * @example
 * if (!rule) {
 *   return notFoundError(res, 'Rule');
 * }
 */
function notFoundError(res, resource = 'Resource') {
  const message = `${resource} not found`;
  console.warn(`[Not Found] ${message}`);
  return res.status(404).json({ error: message });
}

/**
 * Unauthorized error handler
 *
 * Use this for authentication/authorization errors.
 *
 * @param {object} res - Express response object
 * @param {string} [message='Unauthorized'] - Error message
 * @returns {object} Express response
 *
 * @example
 * if (!validCredentials) {
 *   return unauthorizedError(res, 'Invalid credentials');
 * }
 */
function unauthorizedError(res, message = 'Unauthorized') {
  console.warn(`[Unauthorized] ${message}`);
  return res.status(401).json({ error: message });
}

module.exports = {
  errorHandler,
  validationError,
  notFoundError,
  unauthorizedError,
};
