const cron = require('node-cron');
const { getEnabledRules, getSetting, getCredentials, getDueRetries, createRetryEntry, updateRetryEntry, getActiveRetryForRule } = require('../db/database');
const { DAY_NAMES, DEFAULT_BOOKING_ADVANCE_DAYS, RETRY_STATUS } = require('../constants');
const { parsePlaygroundOrder } = require('../utils/json-helpers');
const { findAndBookSlot, checkExistingBooking } = require('../services/booking');
const { executePaymentFlow } = require('../services/payment');
const { cancelBooking } = require('../api/doinsport');
const { logSuccess, logFailure, logPaymentFailure, logCancellation, logNoSlots, logSkipped } = require('../services/logging');

let currentTask = null;

/**
 * Round a future timestamp to the start of the target minute (seconds=0, ms=0).
 * This ensures the cron job (which fires at :05 of each minute) picks it up on time.
 * @param {number} delayMinutes - delay in minutes from now
 * @returns {Date} rounded to the start of the target minute
 */
function nextMinute(delayMinutes) {
  const target = new Date(Date.now() + delayMinutes * 60_000);
  target.setSeconds(0, 0);
  return target;
}

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
        reason: 'Réservation déjà existante pour cette date',
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
      enqueueRetry(rule, targetDate);
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
      // Payment failed - cancel the unpaid booking on DoInSport
      try {
        await cancelBooking(bookingId);
        console.log(`[Scheduler] Réservation ${bookingId} annulée après échec de paiement`);

        logCancellation({
          ruleId: rule.id,
          targetDate,
          targetTime: rule.target_time,
          playground: playground.name,
          bookingId,
          errorMessage: `Paiement échoué: ${paymentErr.message}`,
        });

        return {
          status: 'cancelled',
          bookingId,
          error: paymentErr.message,
        };
      } catch (cancelErr) {
        console.error(`[Scheduler] Échec de l'annulation de ${bookingId}: ${cancelErr.message}`);

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
 * Enqueue a retry for a rule that returned no_slots.
 */
function enqueueRetry(rule, targetDate) {
  const retryConfig = rule.retry_config ? (typeof rule.retry_config === 'string' ? JSON.parse(rule.retry_config) : rule.retry_config) : null;
  if (!retryConfig || retryConfig.length === 0) return;

  const existing = getActiveRetryForRule(rule.id, targetDate);
  if (existing) {
    console.log(`[Retry] Already queued for rule #${rule.id} on ${targetDate}`);
    return;
  }

  const firstStep = retryConfig[0];
  const nextRetry = nextMinute(firstStep.delay_minutes);

  createRetryEntry({
    rule_id: rule.id,
    target_date: targetDate,
    target_time: rule.target_time,
    duration: rule.duration,
    activity: rule.activity || 'football_5v5',
    playground_order: rule.playground_order,
    retry_config: retryConfig,
    next_retry_at: nextRetry.toISOString(),
  });

  console.log(`[Retry] Queued for rule #${rule.id} on ${targetDate}, first retry at ${nextRetry.toISOString()}`);
}

/**
 * Advance a retry entry to its next attempt, following the step escalation config.
 */
function advanceRetry(retry, retryConfig) {
  const newTotalAttempts = retry.total_attempts + 1;
  const newAttemptsInStep = retry.attempts_in_step + 1;
  const currentStep = retryConfig[retry.current_step];

  let nextStep = retry.current_step;
  let nextAttemptsInStep = newAttemptsInStep;

  if (currentStep.count > 0 && newAttemptsInStep >= currentStep.count) {
    nextStep = retry.current_step + 1;
    nextAttemptsInStep = 0;

    if (nextStep >= retryConfig.length) {
      updateRetryEntry(retry.id, {
        total_attempts: newTotalAttempts,
        status: RETRY_STATUS.EXHAUSTED,
      });
      console.log(`[Retry] All steps exhausted for rule #${retry.rule_id} on ${retry.target_date} after ${newTotalAttempts} attempts`);
      logNoSlots({ ruleId: retry.rule_id, targetDate: retry.target_date, targetTime: retry.target_time });
      return;
    }
  }

  const delayMinutes = retryConfig[nextStep].delay_minutes;
  const nextRetryAt = nextMinute(delayMinutes).toISOString();

  updateRetryEntry(retry.id, {
    current_step: nextStep,
    attempts_in_step: nextAttemptsInStep,
    total_attempts: newTotalAttempts,
    next_retry_at: nextRetryAt,
    status: RETRY_STATUS.ACTIVE,
  });

  console.log(`[Retry] Next attempt for rule #${retry.rule_id} at ${nextRetryAt} (step ${nextStep + 1}/${retryConfig.length}, attempt ${nextAttemptsInStep + 1}/${retryConfig[nextStep].count || 'inf'})`);
}

/**
 * Process due retry entries.
 */
async function processRetries() {
  const now = new Date();
  const dueRetries = getDueRetries(now.toISOString());
  if (dueRetries.length === 0) return;

  console.log(`[Retry] Processing ${dueRetries.length} due retry(ies)...`);

  for (const retry of dueRetries) {
    try {
      // Mark as processing so the frontend shows a spinner
      updateRetryEntry(retry.id, { status: RETRY_STATUS.PROCESSING });

      const retryConfig = JSON.parse(retry.retry_config);
      const playgroundOrder = parsePlaygroundOrder(retry.playground_order);

      console.log(`[Retry] Attempt #${retry.total_attempts + 1} for rule #${retry.rule_id} on ${retry.target_date}`);

      const alreadyBooked = await checkExistingBooking(retry.target_date);
      if (alreadyBooked) {
        console.log(`[Retry] Booking already exists for ${retry.target_date}, marking as success`);
        updateRetryEntry(retry.id, { status: RETRY_STATUS.SUCCESS });
        continue;
      }

      const bookingResult = await findAndBookSlot({
        date: retry.target_date,
        targetTime: retry.target_time,
        duration: retry.duration,
        playgroundOrder,
      });

      if (bookingResult) {
        const { bookingId, playground, slot, price, user } = bookingResult;
        try {
          await executePaymentFlow({
            bookingId,
            price: price.pricePerParticipant,
            userId: user.id,
            context: 'retry booking',
          });

          logSuccess({
            ruleId: retry.rule_id,
            targetDate: retry.target_date,
            targetTime: retry.target_time,
            bookedTime: slot.startAt,
            playground: playground.name,
            bookingId,
            price: price.pricePerParticipant,
          });

          updateRetryEntry(retry.id, { status: RETRY_STATUS.SUCCESS, total_attempts: retry.total_attempts + 1 });
          console.log(`[Retry] Success! Booked ${playground.name} at ${slot.startAt} on ${retry.target_date}`);
        } catch (paymentErr) {
          try { await cancelBooking(bookingId); } catch (cancelErr) {
            console.error(`[Retry] Cancel failed for ${bookingId}: ${cancelErr.message}`);
          }
          logCancellation({
            ruleId: retry.rule_id,
            targetDate: retry.target_date,
            targetTime: retry.target_time,
            playground: playground.name,
            bookingId,
            errorMessage: `Paiement echoue lors du retry: ${paymentErr.message}`,
          });
          advanceRetry(retry, retryConfig);
        }
      } else {
        console.log(`[Retry] No slots for rule #${retry.rule_id} on ${retry.target_date}, advancing...`);
        advanceRetry(retry, retryConfig);
      }
    } catch (err) {
      console.error(`[Retry] Error processing retry #${retry.id}: ${err.message}`);
      try {
        const retryConfig = JSON.parse(retry.retry_config);
        advanceRetry(retry, retryConfig);
      } catch {
        updateRetryEntry(retry.id, { status: RETRY_STATUS.EXHAUSTED });
      }
    }
  }
}

/**
 * Check all rules and execute bookings for today's J-45 targets.
 * When triggerTime is provided, only processes rules matching that trigger_time.
 */
async function runScheduledBookings(triggerTime) {
  if (!getCredentials()) {
    console.log('[Scheduler] No credentials configured, skipping.');
    return;
  }

  const rules = getEnabledRules();
  const matching = triggerTime
    ? rules.filter(r => (r.trigger_time || '00:00') === triggerTime)
    : rules;

  if (matching.length === 0) return;

  console.log(`[Scheduler] Checking ${matching.length} rule(s) for trigger time ${triggerTime || 'all'}...`);

  for (const rule of matching) {
    const targetDate = getTargetDateForToday(rule.day_of_week);
    if (targetDate) {
      console.log(`[Scheduler] Rule #${rule.id}: ${DAY_NAMES[rule.day_of_week]} ${rule.target_time} -> target date ${targetDate}`);
      await executeBooking(rule, targetDate);
    }
  }
}

/**
 * Start the cron scheduler.
 * Runs every minute at :05 seconds and checks which rules should trigger at the current HH:MM.
 */
function startScheduler() {
  console.log('[Scheduler] Starting scheduler (checks every minute)...');

  if (currentTask) {
    currentTask.stop();
  }

  // Run at second :05 of every minute
  currentTask = cron.schedule('5 * * * * *', async () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    try {
      await runScheduledBookings(currentTime);
    } catch (err) {
      console.error(`[Scheduler] Error in scheduled run: ${err.message}`);
    }

    try {
      await processRetries();
    } catch (err) {
      console.error(`[Retry] Error in retry processing: ${err.message}`);
    }
  });

  console.log('[Scheduler] Ready.');
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
  enqueueRetry,
  processRetries,
};
