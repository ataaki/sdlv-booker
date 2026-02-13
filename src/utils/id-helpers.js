/**
 * Utilities for extracting IDs from DoInSport API responses
 *
 * The DoInSport API returns objects with either a direct `id` field
 * or an `@id` field containing an IRI (e.g., "/clubs/bookings/abc123")
 */

/**
 * Extract ID from DoInSport API response object
 * Handles both direct 'id' field and IRI '@id' format
 *
 * @param {object} obj - API response object
 * @returns {string|null} The extracted ID, or null if not found
 *
 * @example
 * extractId({ id: '123' }) // => '123'
 * extractId({ '@id': '/clubs/bookings/abc' }) // => 'abc'
 * extractId({}) // => null
 */
function extractId(obj) {
  if (!obj) return null;
  return obj.id || obj['@id']?.split('/').pop();
}

/**
 * Extract and validate ID from API response
 * Throws an error if ID cannot be extracted
 *
 * @param {object} obj - API response object
 * @param {string} [context='API response'] - Description for error messages
 * @returns {string} The extracted ID
 * @throws {Error} If ID cannot be extracted
 *
 * @example
 * extractIdOrThrow({ id: '123' }, 'booking') // => '123'
 * extractIdOrThrow({}, 'booking') // throws Error: 'Failed to extract ID from booking'
 */
function extractIdOrThrow(obj, context = 'API response') {
  const id = extractId(obj);
  if (!id) {
    throw new Error(`Failed to extract ID from ${context}`);
  }
  return id;
}

module.exports = {
  extractId,
  extractIdOrThrow,
};
