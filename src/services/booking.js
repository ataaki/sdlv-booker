/**
 * Booking Service - Centralized booking logic
 *
 * This service provides reusable booking functions for both
 * automated (scheduler) and manual (API routes) bookings.
 */

const {
  findBestSlot,
  createBooking: createBookingApi,
  hasBookingOnDate,
} = require('../api/doinsport');
const { getMe } = require('../api/auth');
const { extractIdOrThrow } = require('../utils/id-helpers');

/**
 * Find an available slot and create a booking
 *
 * This function combines slot finding and booking creation into a single operation.
 * It finds the best available slot based on time and playground preferences,
 * then creates a booking for that slot.
 *
 * @param {object} params
 * @param {string} params.date - Target date in YYYY-MM-DD format
 * @param {string} params.targetTime - Desired time in HH:MM format (e.g., "19:00")
 * @param {number} params.duration - Duration in minutes (60, 90, or 120)
 * @param {string[]|null} [params.playgroundOrder=null] - Preferred playground order (e.g., ["Foot 3", "Foot 7"])
 * @returns {Promise<object|null>} Booking info with slot details, or null if no slots available
 * @returns {string} return.bookingId - DoInSport booking ID
 * @returns {object} return.playground - Playground info with id and name
 * @returns {object} return.slot - Slot info with startAt time
 * @returns {object} return.price - Price info with pricePerParticipant and other details
 *
 * @example
 * const result = await findAndBookSlot({
 *   date: '2025-03-15',
 *   targetTime: '19:00',
 *   duration: 60,
 *   playgroundOrder: ['Foot 3', 'Foot 7']
 * });
 * // => { bookingId: 'abc123', playground: {...}, slot: {...}, price: {...} }
 */
async function findAndBookSlot({
  date,
  targetTime,
  duration,
  playgroundOrder = null,
}) {
  console.log(`[Booking] Finding slot for ${date} at ${targetTime} (${duration}min)`);

  // Find the best available slot
  const best = await findBestSlot(date, targetTime, duration, playgroundOrder);

  if (!best) {
    console.log('[Booking] No available slots found');
    return null;
  }

  console.log(
    `[Booking] Found slot: ${best.playground.name} at ${best.slot.startAt} ` +
    `(${best.price.pricePerParticipant / 100}€/pers)`
  );

  // Get current user info for booking
  const me = await getMe();

  // Create the booking via DoInSport API
  const booking = await createBookingApi({
    playgroundId: best.playground.id,
    priceId: best.price.id,
    date,
    startTime: best.slot.startAt,
    duration,
    userId: me.id,
    lastName: me.lastName,
    pricePerParticipant: best.price.pricePerParticipant,
    maxParticipants: best.price.participantCount,
  });

  const bookingId = extractIdOrThrow(booking, 'booking');
  console.log(`[Booking] Created booking: ${bookingId}`);

  return {
    bookingId,
    playground: best.playground,
    slot: best.slot,
    price: best.price,
    user: me,
  };
}

/**
 * Check if a booking already exists on a given date
 *
 * This prevents duplicate bookings on the same day.
 *
 * @param {string} date - Date to check in YYYY-MM-DD format
 * @returns {Promise<boolean>} True if a booking exists, false otherwise
 *
 * @example
 * const exists = await checkExistingBooking('2025-03-15');
 * // => true or false
 */
async function checkExistingBooking(date) {
  return hasBookingOnDate(date);
}

module.exports = {
  findAndBookSlot,
  checkExistingBooking,
};
