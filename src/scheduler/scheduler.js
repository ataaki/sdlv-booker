const cron = require('node-cron');
const { getEnabledRules, createLog, getSetting } = require('../db/database');
const { findBestSlot, createBooking, createPaymentCart, createPayment, confirmDoinsportPayment, hasBookingOnDate } = require('../api/doinsport');
const { getMe } = require('../api/auth');
const { confirmStripePayment } = require('../api/stripe-confirm');

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function getBookingAdvanceDays() {
  return parseInt(getSetting('booking_advance_days', '45'));
}

/** Format a local Date as YYYY-MM-DD without UTC conversion */
function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

let userInfo = null;

async function getUserInfo() {
  if (!userInfo) {
    userInfo = await getMe();
  }
  return userInfo;
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
  const log = {
    rule_id: rule.id,
    target_date: targetDate,
    target_time: rule.target_time,
    booked_time: null,
    playground: null,
    status: 'pending',
    booking_id: null,
    error_message: null,
  };

  try {
    console.log(`[Scheduler] Attempting booking: ${DAY_NAMES[rule.day_of_week]} ${targetDate} at ${rule.target_time} (${rule.duration}min)`);

    // Check if there's already a booking on this date
    const alreadyBooked = await hasBookingOnDate(targetDate);
    if (alreadyBooked) {
      log.status = 'skipped';
      log.error_message = 'Reservation deja existante pour cette date';
      createLog(log);
      console.log(`[Scheduler] Skipped: already have a booking on ${targetDate}`);
      return log;
    }

    // Parse playground preferences
    const playgroundOrder = rule.playground_order ? JSON.parse(rule.playground_order) : null;

    // Find the best available slot
    const best = await findBestSlot(targetDate, rule.target_time, rule.duration, playgroundOrder);

    if (!best) {
      log.status = 'no_slots';
      log.error_message = 'Aucun créneau disponible';
      createLog(log);
      console.log(`[Scheduler] No slots available for ${targetDate} at ${rule.target_time}`);
      return log;
    }

    console.log(`[Scheduler] Found slot: ${best.playground.name} at ${best.slot.startAt} (${best.price.pricePerParticipant/100} EUR/pers)`);

    // Fill slot info now so logs are complete even if payment fails later
    log.booked_time = best.slot.startAt;
    log.playground = best.playground.name;

    // Get user info for booking
    const me = await getUserInfo();

    // Create the booking (use dynamic price from API)
    const booking = await createBooking({
      playgroundId: best.playground.id,
      priceId: best.price.id,
      date: targetDate,
      startTime: best.slot.startAt,
      duration: rule.duration,
      userId: me.id,
      lastName: me.lastName,
      pricePerParticipant: best.price.pricePerParticipant,
      maxParticipants: best.price.participantCount,
    });

    const bookingId = booking.id || booking['@id']?.split('/').pop();

    // Step 1: Create payment cart + payment
    const cart = await createPaymentCart(bookingId, best.price.pricePerParticipant);
    const cartId = cart.id || cart['@id']?.split('/').pop();

    const { getConfig } = require('../api/config-resolver');
    const { clubClientId } = getConfig();
    const payment = await createPayment(cartId, best.price.pricePerParticipant, clubClientId, me.id);
    const paymentId = payment.id || payment['@id']?.split('/').pop();
    const clientSecret = payment.metadata?.clientSecret;
    console.log(`[Scheduler] Payment created: ${paymentId}, status: ${payment.status}`);

    // Step 2: Confirm via DoInSport API (attaches Stripe source)
    const confirmed = await confirmDoinsportPayment(paymentId);
    console.log(`[Scheduler] DoInSport confirm: ${confirmed.status}`);

    // Step 3: Confirm via Stripe.js (handles 3DS frictionlessly)
    if (confirmed.status !== 'succeeded') {
      const secret = confirmed.metadata?.clientSecret || clientSecret;
      if (!secret) {
        log.status = 'payment_failed';
        log.booking_id = bookingId;
        log.error_message = 'No clientSecret in payment metadata';
        createLog(log);
        return log;
      }

      const stripeResult = await confirmStripePayment(secret);
      console.log(`[Scheduler] Stripe.js confirm: ${stripeResult.status}`);

      if (stripeResult.status !== 'succeeded') {
        log.status = 'payment_failed';
        log.booking_id = bookingId;
        log.error_message = `Stripe payment status: ${stripeResult.status}`;
        createLog(log);
        return log;
      }
    }

    log.status = 'success';
    log.booked_time = best.slot.startAt;
    log.playground = best.playground.name;
    log.booking_id = bookingId;
    createLog(log);

    console.log(`[Scheduler] Booking successful! ${best.playground.name} at ${best.slot.startAt} on ${targetDate}`);
    return log;

  } catch (err) {
    log.status = 'failed';
    log.error_message = err.message;
    createLog(log);
    console.error(`[Scheduler] Booking failed: ${err.message}`);
    return log;
  }
}

/**
 * Check all rules and execute bookings for today's J-45 targets.
 */
async function runScheduledBookings() {
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
