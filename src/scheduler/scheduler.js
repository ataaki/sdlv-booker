const cron = require('node-cron');
const { getEnabledRules, getSetting, getCredentials } = require('../db/database');
const { DAY_NAMES, DEFAULT_BOOKING_ADVANCE_DAYS } = require('../constants');
const { parsePlaygroundOrder } = require('../utils/json-helpers');
const { findAndBookSlot, checkExistingBooking } = require('../services/booking');
const { executePaymentFlow } = require('../services/payment');
const { logSuccess, logFailure, logPaymentFailure, logNoSlots, logSkipped } = require('../services/logging');

function getBookingAdvanceDays() {
  return parseInt(getSetting('booking_advance_days', String(DEFAULT_BOOKING_ADVANCE_DAYS)));
}

/** Format a local Date as YYYY-MM-DD without UTC conversion */
function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


/**
 * Calculate the target date for a booking rule.
 * Bookings open 45 days before the target date.
 * @param {number} dayOfWeek - 0=Sunday, 1=Monday, ..., 6=Saturday
 * @returns {string|null} YYYY-MM-DD of the target date if it should be booked today, null otherwise
 */
function getTargetDateForToday(dayOfWeek) {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + getBookingAdvanceDays());

  if (targetDate.getDay() === dayOfWeek) {
    return formatLocalDate(targetDate);
  }
  return null;
}

/**
 * Get the next date matching a day of week (for manual triggers).
 */
function getNextDateForDay(dayOfWeek) {
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    if (d.getDay() === dayOfWeek) {
      return formatLocalDate(d);
    }
  }
  return null;
}

/**
 * Get the J-45 target info for a rule.
 * Returns the date that will be booked at J-45, and when the bot will attempt it.
 */
function getJ45Info(dayOfWeek) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const advanceDays = getBookingAdvanceDays();

  // The J-N target date = today + N days
  const j45Date = new Date(today);
  j45Date.setDate(j45Date.getDate() + advanceDays);

  // Find how many days until J-45 lands on the rule's day of week
  const j45Day = j45Date.getDay();
  let daysUntilMatch = (dayOfWeek - j45Day + 7) % 7;
  // daysUntilMatch=0 means today's J-45 matches

  // The actual target date
  const targetDate = new Date(j45Date);
  targetDate.setDate(targetDate.getDate() + daysUntilMatch);

  // The bot attempt date = target date - N days
  const attemptDate = new Date(targetDate);
  attemptDate.setDate(attemptDate.getDate() - advanceDays);

  return {
    target_date: formatLocalDate(targetDate),
    attempt_date: formatLocalDate(attemptDate),
    days_until_attempt: Math.round((attemptDate - today) / (24 * 60 * 60 * 1000)),
  };
}

/**
 * Execute a booking for a specific rule and date.
 */
async function executeBooking(rule, targetDate) {
  try {
    console.log(`[Scheduler] Attempting booking: ${DAY_NAMES[rule.day_of_week]} ${targetDate} at ${rule.target_time} (${rule.duration}min)`);

    // Check if there's already a booking on this date
    const alreadyBooked = await checkExistingBooking(targetDate);
    if (alreadyBooked) {
      logSkipped({
        ruleId: rule.id,
        targetDate,
        targetTime: rule.target_time,
        reason: 'Reservation deja existante pour cette date',
      });
      return { status: 'skipped' };
    }

    // Parse playground preferences
    const playgroundOrder = parsePlaygroundOrder(rule.playground_order);

    // Find the best available slot and create booking
    const bookingResult = await findAndBookSlot({
      date: targetDate,
      targetTime: rule.target_time,
      duration: rule.duration,
      playgroundOrder,
    });

    if (!bookingResult) {
      logNoSlots({
        ruleId: rule.id,
        targetDate,
        targetTime: rule.target_time,
      });
      return { status: 'no_slots' };
    }

    const { bookingId, playground, slot, price, user } = bookingResult;

    // Execute payment flow
    try {
      await executePaymentFlow({
        bookingId,
        price: price.pricePerParticipant,
        userId: user.id,
        context: 'scheduled booking',
      });

      // Payment succeeded - log success
      logSuccess({
        ruleId: rule.id,
        targetDate,
        targetTime: rule.target_time,
        bookedTime: slot.startAt,
        playground: playground.name,
        bookingId,
        price: price.pricePerParticipant,
      });

      return {
        status: 'success',
        bookingId,
        playground: playground.name,
        bookedTime: slot.startAt,
      };

    } catch (paymentErr) {
      // Payment failed - log payment failure
      logPaymentFailure({
        ruleId: rule.id,
        targetDate,
        targetTime: rule.target_time,
        bookedTime: slot.startAt,
        playground: playground.name,
        bookingId,
        error: paymentErr,
      });

      return {
        status: 'payment_failed',
        bookingId,
        error: paymentErr.message,
      };
    }

  } catch (err) {
    // General booking failure (slot finding, booking creation)
    logFailure({
      ruleId: rule.id,
      targetDate,
      targetTime: rule.target_time,
      error: err,
    });

    return {
      status: 'failed',
      error: err.message,
    };
  }
}

/**
 * Check all rules and execute bookings for today's J-45 targets.
 */
async function runScheduledBookings() {
  if (!getCredentials()) {
    console.log('[Scheduler] No credentials configured, skipping.');
    return;
  }

  const rules = getEnabledRules();
  console.log(`[Scheduler] Checking ${rules.length} active rules...`);

  for (const rule of rules) {
    const targetDate = getTargetDateForToday(rule.day_of_week);
    if (targetDate) {
      console.log(`[Scheduler] Rule #${rule.id}: ${DAY_NAMES[rule.day_of_week]} ${rule.target_time} -> target date ${targetDate}`);
      await executeBooking(rule, targetDate);
    }
  }
}

/**
 * Start the cron scheduler.
 * Runs every day at 00:00:05 (5 seconds after midnight to ensure date rollover).
 */
function startScheduler() {
  console.log('[Scheduler] Starting scheduler (runs daily at 00:00:05)...');

  // Run at 00:00:05 every day
  cron.schedule('5 0 0 * * *', async () => {
    console.log(`[Scheduler] Cron triggered at ${new Date().toISOString()}`);
    try {
      await runScheduledBookings();
    } catch (err) {
      console.error(`[Scheduler] Error in scheduled run: ${err.message}`);
    }
  });

  // Also run immediately on startup to check if any bookings are pending
  console.log('[Scheduler] Running initial check...');
  runScheduledBookings().catch(err => {
    console.error(`[Scheduler] Error in initial run: ${err.message}`);
  });
}

module.exports = {
  startScheduler,
  runScheduledBookings,
  executeBooking,
  getTargetDateForToday,
  getNextDateForDay,
  getJ45Info,
  DAY_NAMES,
  getBookingAdvanceDays,
};
