const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { getPlanning, findAllSlots, findBestSlot, cancelBooking, getMyBookings, PLAYGROUNDS, PLAYGROUND_NAMES } = require('../api/doinsport');
const { login, getMe, resetToken } = require('../api/auth');
const { executeBooking, getNextDateForDay, getJ45Info, DAY_NAMES, getBookingAdvanceDays } = require('../scheduler/scheduler');
const { resolveConfig, resetConfig } = require('../api/config-resolver');
const { VALID_DURATIONS } = require('../constants');
const { parsePlaygroundOrder } = require('../utils/json-helpers');
const { validateTimeFormat, validateDuration, validateBookingRule, validateBookingAdvanceDays, validateRetryConfig } = require('../utils/validators');
const { errorHandler, validationError, notFoundError } = require('../middleware/error-handler');
const { findAndBookSlot } = require('../services/booking');
const { executePaymentFlow } = require('../services/payment');
const { logSuccess, logPaymentFailure, logCancellation } = require('../services/logging');
const { sendTestMessage } = require('../services/telegram');

// --- Credentials ---

router.get('/credentials/status', (req, res) => {
  const creds = db.getCredentials();
  res.json({ configured: !!creds, email: creds ? creds.email : null });
});

router.put('/credentials', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  // Test login before saving
  try {
    await login(email, password);
  } catch (err) {
    return res.status(401).json({ error: 'Identifiants invalides : ' + err.message });
  }

  // Save to DB and reset cached token/config
  db.setCredentials(email, password);
  resetToken();
  resetConfig();

  // Re-resolve config with new credentials
  try {
    await resolveConfig();
  } catch (err) {
    console.error('[Config] Failed to resolve after credentials update:', err.message);
  }

  res.json({ success: true });
});

// --- Rules CRUD ---

router.get('/rules', (req, res) => {
  const rules = db.getAllRules();
  res.json(rules);
});

router.post('/rules', (req, res) => {
  const { day_of_week, target_time, trigger_time, duration, playground_order, retry_config } = req.body;

  const errors = validateBookingRule({ day_of_week, target_time, duration });
  if (errors.length > 0) return validationError(res, errors[0]);

  const retryError = validateRetryConfig(retry_config);
  if (retryError) return validationError(res, retryError);

  const rule = db.createRule({
    day_of_week,
    target_time,
    trigger_time: trigger_time || '00:00',
    duration: duration || 60,
    playground_order: playground_order || null,
    retry_config: retry_config || null,
  });
  res.status(201).json(rule);
});

router.put('/rules/:id', (req, res) => {
  const rule = db.getRuleById(req.params.id);
  if (!rule) return notFoundError(res, 'Rule');

  const { day_of_week, target_time, duration } = req.body;
  const errors = validateBookingRule({
    day_of_week: day_of_week !== undefined ? day_of_week : rule.day_of_week,
    target_time: target_time !== undefined ? target_time : rule.target_time,
    duration: duration !== undefined ? duration : rule.duration,
  });
  if (errors.length > 0) {
    return validationError(res, errors[0]);
  }

  if (req.body.retry_config !== undefined) {
    const retryError = validateRetryConfig(req.body.retry_config);
    if (retryError) return validationError(res, retryError);
  }

  const updated = db.updateRule(req.params.id, req.body);
  res.json(updated);
});

router.delete('/rules/:id', (req, res) => {
  const rule = db.getRuleById(req.params.id);
  if (!rule) return notFoundError(res, 'Rule');

  db.deleteRule(req.params.id);
  res.json({ success: true });
});

// --- Retry Queue ---

router.get('/retries', (req, res) => {
  const retries = db.getActiveRetries();
  res.json(retries);
});

router.delete('/retries/:id', (req, res) => {
  const retry = db.getRetryById(req.params.id);
  if (!retry) return notFoundError(res, 'Retry');
  db.cancelRetryEntry(parseInt(req.params.id));
  res.json({ success: true });
});

// --- Logs ---

router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const logs = db.getLogs(limit);
  res.json(logs);
});

router.delete('/logs', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }
  db.deleteLogs(ids.map(id => parseInt(id)));
  res.json({ success: true, deleted: ids.length });
});

// --- Settings ---

router.get('/settings', (req, res) => {
  const token = db.getSetting('telegram_bot_token', '');
  const maskedToken = token ? '****' + token.slice(-4) : '';
  res.json({
    booking_advance_days: parseInt(db.getSetting('booking_advance_days', '45')),
    timezone: db.getSetting('timezone', 'Europe/Paris'),
    telegram_bot_token: maskedToken,
    telegram_chat_id: db.getSetting('telegram_chat_id', ''),
  });
});

router.put('/settings', (req, res) => {
  const { booking_advance_days, telegram_bot_token, telegram_chat_id } = req.body;

  if (booking_advance_days !== undefined) {
    const error = validateBookingAdvanceDays(booking_advance_days);
    if (error) return validationError(res, error);
    db.setSetting('booking_advance_days', parseInt(booking_advance_days));
  }

  if (telegram_bot_token !== undefined) {
    db.setSetting('telegram_bot_token', telegram_bot_token.trim());
  }

  if (telegram_chat_id !== undefined) {
    db.setSetting('telegram_chat_id', telegram_chat_id.trim());
  }

  if (req.body.timezone !== undefined) {
    const tz = req.body.timezone.trim();
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      db.setSetting('timezone', tz);
      process.env.TZ = tz;
    } catch {
      return validationError(res, `Fuseau horaire invalide : ${tz}`);
    }
  }

  res.json({ success: true });
});

router.post('/telegram/test', async (req, res) => {
  try {
    await sendTestMessage();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Server Time ---

router.get('/time', (req, res) => {
  res.json({ time: new Date().toISOString(), timezone: process.env.TZ || 'Europe/Paris' });
});

// --- Planning / Preview ---

router.get('/planning/:date', async (req, res) => {
  try {
    const planning = await getPlanning(req.params.date);
    res.json(planning);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/check-slot', async (req, res) => {
  try {
    const { date, time, duration } = req.query;
    if (!date || !time) {
      return res.status(400).json({ error: 'date and time query params required' });
    }
    const best = await findBestSlot(date, time, parseInt(duration) || 60);
    res.json(best || { available: false, message: 'Aucun créneau disponible' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Manual Booking Trigger ---

router.post('/book-now', async (req, res) => {
  try {
    const { rule_id, date } = req.body;

    if (!rule_id) {
      return res.status(400).json({ error: 'rule_id is required' });
    }

    const rule = db.getRuleById(rule_id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    // Use provided date or calculate next available date for the rule's day
    let targetDate = date;
    if (!targetDate) {
      targetDate = getNextDateForDay(rule.day_of_week);
      if (!targetDate) return res.status(400).json({ error: 'No upcoming date found' });
    }

    const result = await executeBooking(rule, targetDate);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Bookings (live from DoInSport) ---

router.get('/bookings', async (req, res) => {
  try {
    const {
      status = 'upcoming',
      limit = '20',
      page = '1',
      includeCanceled = 'false',
    } = req.query;

    // Validate status
    const validStatuses = ['upcoming', 'past', 'all'];
    if (!validStatuses.includes(status)) {
      return validationError(res, `status must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate pagination
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return validationError(res, 'limit must be between 1 and 100');
    }
    if (isNaN(pageNum) || pageNum < 1) {
      return validationError(res, 'page must be >= 1');
    }

    const result = await getMyBookings({
      status,
      limit: limitNum,
      page: pageNum,
      includeCanceled: includeCanceled === 'true',
    });

    res.json(result);
  } catch (err) {
    return errorHandler(err, res, 500);
  }
});

router.delete('/bookings/:id', async (req, res) => {
  try {
    const { date, time, playground } = req.query;
    await cancelBooking(req.params.id);

    // Log the cancellation
    if (date) {
      logCancellation({
        targetDate: date,
        targetTime: time,
        playground,
        bookingId: req.params.id,
      });
    }

    res.json({ success: true, message: 'Réservation annulée (remboursement automatique si paiement effectué)' });
  } catch (err) {
    return errorHandler(err, res, 500);
  }
});

// --- Manual Booking (free-form, not tied to a rule) ---

router.get('/slots', async (req, res) => {
  try {
    const { date, duration, from, to } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });

    // If duration specified, fetch for that duration only; otherwise fetch all 3 in parallel
    const durations = duration ? [parseInt(duration)] : [60, 90, 120];
    const results = await Promise.all(durations.map(dur => findAllSlots(date, dur)));
    let allSlots = results.flat();

    // Sort by time, then duration, then playground name
    allSlots.sort((a, b) => {
      const timeCmp = a.slot.startAt.localeCompare(b.slot.startAt);
      if (timeCmp !== 0) return timeCmp;
      const durCmp = a.price.duration - b.price.duration;
      if (durCmp !== 0) return durCmp;
      return a.playground.name.localeCompare(b.playground.name);
    });

    // Filter by time range if provided
    if (from) allSlots = allSlots.filter(s => s.slot.startAt >= from);
    if (to) allSlots = allSlots.filter(s => s.slot.startAt <= to);

    res.json(allSlots.map(s => ({
      playground: s.playground,
      startAt: s.slot.startAt,
      priceId: s.price.id,
      price: s.price.pricePerParticipant,
      duration: s.price.duration / 60,
      participantCount: s.price.participantCount,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/book-manual', async (req, res) => {
  try {
    const { date, startTime, duration, playgroundName } = req.body;

    // Validate required fields
    if (!date || !startTime || !playgroundName) {
      return validationError(res, 'date, startTime, and playgroundName are required');
    }

    // Validate duration
    const dur = parseInt(duration) || 60;
    const durationError = validateDuration(dur);
    if (durationError) {
      return validationError(res, durationError);
    }

    // Validate playground exists
    if (!PLAYGROUNDS[playgroundName]) {
      return validationError(res, `Unknown playground: ${playgroundName}`);
    }

    // Find the exact slot to get the correct price
    const slots = await findAllSlots(date, dur);
    const match = slots.find(s => s.slot.startAt === startTime && s.playground.name === playgroundName);
    if (!match) {
      return validationError(res, 'Créneau non disponible');
    }

    // Create booking using service
    const me = await getMe();
    const { createBooking } = require('../api/doinsport');
    const booking = await createBooking({
      playgroundId: match.playground.id,
      priceId: match.price.id,
      date,
      startTime,
      duration: dur,
      userId: me.id,
      lastName: me.lastName,
      pricePerParticipant: match.price.pricePerParticipant,
      maxParticipants: match.price.participantCount,
    });

    const { extractIdOrThrow } = require('../utils/id-helpers');
    const bookingId = extractIdOrThrow(booking, 'booking');

    // Execute payment flow using service (eliminates 37 lines of duplication)
    try {
      await executePaymentFlow({
        bookingId,
        price: match.price.pricePerParticipant,
        userId: me.id,
        context: 'manual booking',
      });

      // Log success
      logSuccess({
        ruleId: null,
        targetDate: date,
        targetTime: startTime,
        bookedTime: startTime,
        playground: playgroundName,
        bookingId,
        price: match.price.pricePerParticipant,
      });

      res.json({
        status: 'success',
        target_date: date,
        booked_time: startTime,
        playground: playgroundName,
        booking_id: bookingId,
        price: match.price.pricePerParticipant,
        confirmed: true,
      });

    } catch (paymentErr) {
      // Log payment failure
      logPaymentFailure({
        ruleId: null,
        targetDate: date,
        targetTime: startTime,
        bookedTime: startTime,
        playground: playgroundName,
        bookingId,
        error: paymentErr,
      });

      return errorHandler(paymentErr, res, 500);
    }

  } catch (err) {
    return errorHandler(err, res, 500);
  }
});

// --- Dashboard Info ---

router.get('/dashboard', (req, res) => {
  const rules = db.getAllRules();
  const logs = db.getLogs(20);

  // Calculate J-45 info for each rule
  const rulesWithInfo = rules.map(rule => ({
    ...rule,
    playground_order: parsePlaygroundOrder(rule.playground_order),
    retry_config: rule.retry_config ? JSON.parse(rule.retry_config) : null,
    day_name: DAY_NAMES[rule.day_of_week],
    j45: getJ45Info(rule.day_of_week),
    duration_label: `${rule.duration} min`,
  }));

  const creds = db.getCredentials();
  const activeRetries = db.getActiveRetries().map(r => ({
    ...r,
    retry_config: JSON.parse(r.retry_config),
    playground_order: r.playground_order ? JSON.parse(r.playground_order) : null,
  }));
  res.json({
    rules: rulesWithInfo,
    recent_logs: logs,
    active_retries: activeRetries,
    credentials_configured: !!creds,
    config: {
      advance_days: getBookingAdvanceDays(),
      timezone: process.env.TZ || 'Europe/Paris',
      playgrounds: PLAYGROUNDS,
      playground_names: PLAYGROUND_NAMES,
      durations: VALID_DURATIONS,
      day_names: DAY_NAMES,
    },
  });
});

module.exports = router;
