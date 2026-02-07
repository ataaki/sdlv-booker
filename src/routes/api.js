const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { getPlanning, findAllSlots, findBestSlot, createBooking, createPaymentCart, createPayment, confirmDoinsportPayment, cancelBooking, getMyBookings, PLAYGROUNDS, PLAYGROUND_NAMES } = require('../api/doinsport');
const { getMe } = require('../api/auth');
const { confirmStripePayment } = require('../api/stripe-confirm');
const { executeBooking, getNextDateForDay, getJ45Info, DAY_NAMES, getBookingAdvanceDays } = require('../scheduler/scheduler');

// --- Rules CRUD ---

router.get('/rules', (req, res) => {
  const rules = db.getAllRules();
  res.json(rules);
});

router.post('/rules', (req, res) => {
  const { day_of_week, target_time, duration, playground_order } = req.body;

  if (day_of_week === undefined || !target_time) {
    return res.status(400).json({ error: 'day_of_week and target_time are required' });
  }

  if (day_of_week < 0 || day_of_week > 6) {
    return res.status(400).json({ error: 'day_of_week must be 0-6 (0=Dimanche)' });
  }

  if (!/^\d{2}:\d{2}$/.test(target_time)) {
    return res.status(400).json({ error: 'target_time must be HH:MM format' });
  }

  const validDurations = [60, 90, 120];
  if (duration && !validDurations.includes(duration)) {
    return res.status(400).json({ error: 'duration must be 60, 90, or 120' });
  }

  const rule = db.createRule({ day_of_week, target_time, duration: duration || 60, playground_order: playground_order || null });
  res.status(201).json(rule);
});

router.put('/rules/:id', (req, res) => {
  const rule = db.getRuleById(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  const updated = db.updateRule(req.params.id, req.body);
  res.json(updated);
});

router.delete('/rules/:id', (req, res) => {
  const rule = db.getRuleById(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  db.deleteRule(req.params.id);
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
  res.json({
    booking_advance_days: parseInt(db.getSetting('booking_advance_days', '45')),
  });
});

router.put('/settings', (req, res) => {
  const { booking_advance_days } = req.body;
  if (booking_advance_days !== undefined) {
    const val = parseInt(booking_advance_days);
    if (isNaN(val) || val < 1 || val > 90) {
      return res.status(400).json({ error: 'booking_advance_days doit être entre 1 et 90' });
    }
    db.setSetting('booking_advance_days', val);
  }
  res.json({ success: true, booking_advance_days: parseInt(db.getSetting('booking_advance_days', '45')) });
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
    const bookings = await getMyBookings();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/bookings/:id', async (req, res) => {
  try {
    const { date, time, playground } = req.query;
    await cancelBooking(req.params.id);

    // Log the cancellation
    if (date) {
      db.createLog({
        rule_id: null,
        target_date: date,
        target_time: time || '-',
        booked_time: time || null,
        playground: playground || null,
        status: 'cancelled',
        booking_id: req.params.id,
        error_message: null,
      });
    }

    res.json({ success: true, message: 'Reservation annulee (remboursement automatique si paiement effectue)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Manual Booking (free-form, not tied to a rule) ---

router.get('/slots', async (req, res) => {
  try {
    const { date, duration, from, to } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });

    // If duration specified, fetch for that duration only; otherwise fetch all 3
    const durations = duration ? [parseInt(duration)] : [60, 90, 120];
    let allSlots = [];
    for (const dur of durations) {
      const slots = await findAllSlots(date, dur);
      allSlots.push(...slots);
    }

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
      duration: s.price.duration,
      participantCount: s.price.participantCount,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/book-manual', async (req, res) => {
  try {
    const { date, startTime, duration, playgroundName } = req.body;

    if (!date || !startTime || !playgroundName) {
      return res.status(400).json({ error: 'date, startTime, and playgroundName are required' });
    }

    const dur = parseInt(duration) || 60;
    const playgroundId = PLAYGROUNDS[playgroundName];
    if (!playgroundId) return res.status(400).json({ error: `Unknown playground: ${playgroundName}` });

    // Find the exact slot to get the correct price
    const slots = await findAllSlots(date, dur);
    const match = slots.find(s => s.slot.startAt === startTime && s.playground.name === playgroundName);
    if (!match) return res.status(400).json({ error: 'Creneau non disponible' });

    const me = await getMe();

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

    const bookingId = booking.id || booking['@id']?.split('/').pop();

    // Step 1: Create payment cart + payment
    const cart = await createPaymentCart(bookingId, match.price.pricePerParticipant);
    const cartId = cart.id || cart['@id']?.split('/').pop();

    const { getConfig } = require('../api/config-resolver');
    const { clubClientId } = getConfig();
    const payment = await createPayment(cartId, match.price.pricePerParticipant, clubClientId, me.id);
    const paymentId = payment.id || payment['@id']?.split('/').pop();

    // Step 2: Confirm via DoInSport API
    const confirmed = await confirmDoinsportPayment(paymentId);

    // Step 3: Confirm via Stripe.js if needed
    if (confirmed.status !== 'succeeded') {
      const clientSecret = confirmed.metadata?.clientSecret || payment.metadata?.clientSecret;
      if (!clientSecret) {
        db.createLog({
          rule_id: null, target_date: date, target_time: startTime,
          booked_time: startTime, playground: playgroundName,
          status: 'payment_failed', booking_id: bookingId,
          error_message: 'No clientSecret in payment metadata',
        });
        return res.status(500).json({ error: 'Payment failed: no clientSecret', booking_id: bookingId });
      }

      const stripeResult = await confirmStripePayment(clientSecret);
      if (stripeResult.status !== 'succeeded') {
        db.createLog({
          rule_id: null, target_date: date, target_time: startTime,
          booked_time: startTime, playground: playgroundName,
          status: 'payment_failed', booking_id: bookingId,
          error_message: `Stripe payment status: ${stripeResult.status}`,
        });
        return res.status(500).json({ error: `Payment failed: ${stripeResult.status}`, booking_id: bookingId });
      }
    }

    // Log the manual booking
    db.createLog({
      rule_id: null,
      target_date: date,
      target_time: startTime,
      booked_time: startTime,
      playground: playgroundName,
      status: 'success',
      booking_id: bookingId,
      error_message: null,
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Dashboard Info ---

router.get('/dashboard', (req, res) => {
  const rules = db.getAllRules();
  const logs = db.getLogs(20);

  // Calculate J-45 info for each rule
  const rulesWithInfo = rules.map(rule => ({
    ...rule,
    playground_order: rule.playground_order ? JSON.parse(rule.playground_order) : null,
    day_name: DAY_NAMES[rule.day_of_week],
    j45: getJ45Info(rule.day_of_week),
    duration_label: `${rule.duration} min`,
  }));

  res.json({
    rules: rulesWithInfo,
    recent_logs: logs,
    config: {
      advance_days: getBookingAdvanceDays(),
      playgrounds: PLAYGROUNDS,
      playground_names: PLAYGROUND_NAMES,
      durations: [60, 90, 120],
      day_names: DAY_NAMES,
    },
  });
});

module.exports = router;
