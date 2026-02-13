/**
 * Utilities for safe JSON parsing
 */

/**
 * Safely parse JSON with optional default value handling
 * Catches JSON parsing errors and returns default value instead
 *
 * @param {string|null|undefined} jsonString - JSON string to parse
 * @param {*} [defaultValue=null] - Value to return if JSON is null/undefined/invalid
 * @returns {*} Parsed object or default value
 *
 * @example
 * parseJsonOrDefault('{"foo": "bar"}') // => { foo: 'bar' }
 * parseJsonOrDefault(null) // => null
 * parseJsonOrDefault('invalid json', []) // => []
 * parseJsonOrDefault('', {}) // => {}
 */
function parseJsonOrDefault(jsonString, defaultValue = null) {
  if (!jsonString) return defaultValue;

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.warn('[JSON] Failed to parse:', jsonString.substring(0, 100));
    return defaultValue;
  }
}

/**
 * Safely parse playground order JSON array
 * Used for parsing the playground_order field from booking rules
 *
 * @param {string|null|undefined} jsonString - JSON array string (e.g., '["Foot 3", "Foot 7"]')
 * @returns {string[]|null} Parsed array of playground names, or null if invalid/empty
 *
 * @example
 * parsePlaygroundOrder('["Foot 3", "Foot 7"]') // => ['Foot 3', 'Foot 7']
 * parsePlaygroundOrder(null) // => null
 * parsePlaygroundOrder('') // => null
 */
function parsePlaygroundOrder(jsonString) {
  return parseJsonOrDefault(jsonString, null);
}

module.exports = {
  parseJsonOrDefault,
  parsePlaygroundOrder,
};
