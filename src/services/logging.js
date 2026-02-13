/**
 * Logging Service - Centralized booking result logging
 *
 * This service provides consistent logging across scheduler and API routes.
 * All booking attempts (successful or failed) are logged to the database.
 */

const db = require('../db/database');
const { BOOKING_STATUS } = require('../constants');

/**
 * Create a booking result log entry
 *
 * @param {object} params
 * @param {number|null} params.ruleId - Booking rule ID (null for manual bookings)
 * @param {string} params.targetDate - Target date in YYYY-MM-DD format
 * @param {string} params.targetTime - Target time in HH:MM format
 * @param {string} [params.bookedTime] - Actual booked time in HH:MM format
 * @param {string} [params.playground] - Booked playground name (e.g., "Foot 3")
 * @param {string} params.status - Booking status (use BOOKING_STATUS constants)
 * @param {string} [params.bookingId] - DoInSport booking ID if created
 * @param {string} [params.errorMessage] - Error message if booking failed
 * @returns {object} Database insert result
 *
 * @example
 * logBookingResult({
 *   ruleId: 5,
 *   targetDate: '2025-03-15',
 *   targetTime: '19:00',
 *   bookedTime: '19:00',
 *   playground: 'Foot 3',
 *   status: BOOKING_STATUS.SUCCESS,
 *   bookingId: 'abc123'
 * });
 */
function logBookingResult({
  ruleId,
  targetDate,
  targetTime,
  bookedTime = null,
  playground = null,
  status,
  bookingId = null,
  errorMessage = null,
}) {
  return db.createLog({
    rule_id: ruleId,
    target_date: targetDate,
    target_time: targetTime,
    booked_time: bookedTime,
    playground,
    status,
    booking_id: bookingId,
    error_message: errorMessage,
  });
}

/**
 * Log a successful booking
 *
 * @param {object} params
 * @param {number|null} params.ruleId - Booking rule ID (null for manual)
 * @param {string} params.targetDate - Target date
 * @param {string} params.targetTime - Target time
 * @param {string} params.bookedTime - Actual booked time
 * @param {string} params.playground - Playground name
 * @param {string} params.bookingId - DoInSport booking ID
 * @param {number} [params.price] - Price in cents (for console log)
 * @returns {object} Database insert result
 *
 * @example
 * logSuccess({
 *   ruleId: null,
 *   targetDate: '2025-03-15',
 *   targetTime: '19:00',
 *   bookedTime: '19:00',
 *   playground: 'Foot 3',
 *   bookingId: 'abc123',
 *   price: 1200
 * });
 */
function logSuccess({ ruleId, targetDate, targetTime, bookedTime, playground, bookingId, price }) {
  const priceStr = price ? ` (${price / 100}€/pers)` : '';
  console.log(`[Booking] Success: ${playground} at ${bookedTime} on ${targetDate}${priceStr}`);

  return logBookingResult({
    ruleId,
    targetDate,
    targetTime,
    bookedTime,
    playground,
    status: BOOKING_STATUS.SUCCESS,
    bookingId,
  });
}

/**
 * Log a failed booking
 *
 * @param {object} params
 * @param {number|null} params.ruleId - Booking rule ID
 * @param {string} params.targetDate - Target date
 * @param {string} params.targetTime - Target time
 * @param {string} [params.bookedTime] - Booked time if booking was created
 * @param {string} [params.playground] - Playground name if slot was found
 * @param {string} [params.bookingId] - Booking ID if booking was created
 * @param {Error|string} params.error - Error object or message
 * @returns {object} Database insert result
 *
 * @example
 * logFailure({
 *   ruleId: 5,
 *   targetDate: '2025-03-15',
 *   targetTime: '19:00',
 *   error: new Error('API connection failed')
 * });
 */
function logFailure({ ruleId, targetDate, targetTime, bookedTime, playground, bookingId, error }) {
  const errorMessage = error?.message || String(error);
  console.error(`[Booking] Failed: ${errorMessage}`);

  return logBookingResult({
    ruleId,
    targetDate,
    targetTime,
    bookedTime,
    playground,
    status: BOOKING_STATUS.FAILED,
    bookingId,
    errorMessage,
  });
}

/**
 * Log a payment failure
 *
 * Payment failures occur after a booking has been created but payment confirmation fails.
 * The booking exists but is not confirmed/paid.
 *
 * @param {object} params
 * @param {number|null} params.ruleId - Booking rule ID
 * @param {string} params.targetDate - Target date
 * @param {string} params.targetTime - Target time
 * @param {string} params.bookedTime - Booked time
 * @param {string} params.playground - Playground name
 * @param {string} params.bookingId - DoInSport booking ID
 * @param {Error|string} params.error - Payment error
 * @returns {object} Database insert result
 *
 * @example
 * logPaymentFailure({
 *   ruleId: null,
 *   targetDate: '2025-03-15',
 *   targetTime: '19:00',
 *   bookedTime: '19:00',
 *   playground: 'Foot 3',
 *   bookingId: 'abc123',
 *   error: new Error('Stripe payment failed')
 * });
 */
function logPaymentFailure({ ruleId, targetDate, targetTime, bookedTime, playground, bookingId, error }) {
  const errorMessage = error?.message || String(error);
  console.error(`[Payment] Failed: ${errorMessage}`);

  return logBookingResult({
    ruleId,
    targetDate,
    targetTime,
    bookedTime,
    playground,
    status: BOOKING_STATUS.PAYMENT_FAILED,
    bookingId,
    errorMessage,
  });
}

/**
 * Log when no slots are available
 *
 * @param {object} params
 * @param {number} params.ruleId - Booking rule ID
 * @param {string} params.targetDate - Target date
 * @param {string} params.targetTime - Target time
 * @returns {object} Database insert result
 */
function logNoSlots({ ruleId, targetDate, targetTime }) {
  console.log(`[Booking] No slots available for ${targetDate} at ${targetTime}`);

  return logBookingResult({
    ruleId,
    targetDate,
    targetTime,
    status: BOOKING_STATUS.NO_SLOTS,
    errorMessage: 'Aucun créneau disponible',
  });
}

/**
 * Log when a booking is skipped (e.g., already exists)
 *
 * @param {object} params
 * @param {number} params.ruleId - Booking rule ID
 * @param {string} params.targetDate - Target date
 * @param {string} params.targetTime - Target time
 * @param {string} params.reason - Reason for skipping
 * @returns {object} Database insert result
 */
function logSkipped({ ruleId, targetDate, targetTime, reason }) {
  console.log(`[Booking] Skipped: ${reason}`);

  return logBookingResult({
    ruleId,
    targetDate,
    targetTime,
    status: BOOKING_STATUS.SKIPPED,
    errorMessage: reason,
  });
}

/**
 * Log a cancelled booking
 *
 * @param {object} params
 * @param {string} params.targetDate - Date of cancelled booking
 * @param {string} [params.targetTime] - Time of cancelled booking
 * @param {string} [params.playground] - Playground name
 * @param {string} params.bookingId - DoInSport booking ID
 * @returns {object} Database insert result
 */
function logCancellation({ targetDate, targetTime, playground, bookingId }) {
  console.log(`[Booking] Cancelled: ${bookingId} on ${targetDate}`);

  return logBookingResult({
    ruleId: null,
    targetDate,
    targetTime: targetTime || '-',
    playground,
    status: BOOKING_STATUS.CANCELLED,
    bookingId,
  });
}

module.exports = {
  logBookingResult,
  logSuccess,
  logFailure,
  logPaymentFailure,
  logNoSlots,
  logSkipped,
  logCancellation,
};
