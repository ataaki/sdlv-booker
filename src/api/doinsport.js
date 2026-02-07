const { getToken } = require('./auth');
const { getConfig, CLUB_ID } = require('./config-resolver');

const API_BASE = 'https://api-v3.doinsport.club';
const ACTIVITY_FOOTBALL_5V5 = 'cc4da804-1ef4-4f57-9fa4-4c203cdc06c8';
const CATEGORY_FOOTBALL = '910503af-d67a-4f2b-a0df-838e0b4fb8ac';

const PLAYGROUND_NAMES = ['Foot 1', 'Foot 2', 'Foot 3', 'Foot 4', 'Foot 5', 'Foot 6', 'Foot 7'];

const PLAYGROUNDS = {
  'Foot 1': 'b5a0b1d1-8272-4fd0-9618-ab878c08ec7e',
  'Foot 2': 'a7724c1d-8a2f-4f43-906c-bc6ccefc2b4c',
  'Foot 3': '0111e443-e79c-4fee-87d2-4ddc329e1f5b',
  'Foot 4': '5fdabcc0-07a0-4ff9-93f5-bf5855eed3b3',
  'Foot 5': '6bbe9dd0-7073-4fbe-bf41-a06425cb5a9f',
  'Foot 6': '05e9bb22-5b63-4fd2-a720-db7715fe96a8',
  'Foot 7': '282f45b9-5786-4f82-90d5-ef07d7eeeffb',
};

async function authFetch(url, options = {}) {
  const token = await getToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/ld+json',
    ...options.headers,
  };
  return fetch(url, { ...options, headers });
}

/**
 * Get available slots for a given date.
 * @param {string} date - Format YYYY-MM-DD
 * @param {string} from - Start time HH:MM
 * @param {string} to - End time HH:MM (exclusive, API adds 29 min)
 * @returns {object} Planning data with playgrounds and slots
 */
async function getPlanning(date, from = '00:00', to = '23:59') {
  const url = `${API_BASE}/clubs/playgrounds/plannings/${date}?club.id=${CLUB_ID}&from=${from}&to=${to}&activities.id=${ACTIVITY_FOOTBALL_5V5}&bookingType=unique`;
  const res = await authFetch(url);
  if (!res.ok) {
    throw new Error(`getPlanning failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Get all available slots for a date and duration.
 * @param {string} date - YYYY-MM-DD
 * @param {number} duration - Duration in minutes (60, 90, 120)
 * @returns {Array} Array of { playground, slot, price } sorted by time then playground name
 */
async function findAllSlots(date, duration = 60) {
  const planning = await getPlanning(date);
  const durationSeconds = duration * 60;

  if (!planning['hydra:member'] || planning['hydra:member'].length === 0) {
    return [];
  }

  const candidates = [];

  for (const playground of planning['hydra:member']) {
    const activity = Object.values(playground.activities)[0];
    if (!activity || !activity.slots) continue;

    for (const slot of activity.slots) {
      const price = slot.prices.find(p => p.duration === durationSeconds && p.bookable);
      if (price) {
        candidates.push({
          playground: { id: playground.id, name: playground.name },
          slot,
          price,
        });
      }
    }
  }

  // Sort by time, then playground name
  candidates.sort((a, b) => {
    const timeCmp = timeToMinutes(a.slot.startAt) - timeToMinutes(b.slot.startAt);
    if (timeCmp !== 0) return timeCmp;
    return a.playground.name.localeCompare(b.playground.name);
  });

  return candidates;
}

/**
 * Find the best available slot for a target time, with fallback to closest later slot.
 * @param {string} date - YYYY-MM-DD
 * @param {string} targetTime - HH:MM (local time, e.g. "19:00")
 * @param {number} duration - Duration in minutes (60, 90, 120)
 * @param {string[]|null} playgroundOrder - Ordered list of preferred playground names (e.g. ["Foot 3", "Foot 7"])
 * @returns {object|null} { playground, slot, price } or null
 */
async function findBestSlot(date, targetTime, duration = 60, playgroundOrder = null) {
  const candidates = await findAllSlots(date, duration);
  if (candidates.length === 0) return null;

  // Build playground preference rank map
  const pgRank = {};
  if (playgroundOrder && playgroundOrder.length > 0) {
    playgroundOrder.forEach((name, i) => { pgRank[name] = i; });
  }

  // Sort by: 1) time distance from target, 2) playground preference
  const targetMinutes = timeToMinutes(targetTime);

  candidates.sort((a, b) => {
    const aMinutes = timeToMinutes(a.slot.startAt);
    const bMinutes = timeToMinutes(b.slot.startAt);
    const aDiff = aMinutes - targetMinutes;
    const bDiff = bMinutes - targetMinutes;

    // Prefer slots at or after target time
    if (aDiff >= 0 && bDiff < 0) return -1;
    if (aDiff < 0 && bDiff >= 0) return 1;

    // Among same direction, prefer closest time
    let timeCmp;
    if (aDiff >= 0 && bDiff >= 0) {
      timeCmp = aDiff - bDiff;
    } else {
      timeCmp = Math.abs(aDiff) - Math.abs(bDiff);
    }

    // If same time, prefer playground by preference order
    if (timeCmp === 0 && playgroundOrder && playgroundOrder.length > 0) {
      const aRank = pgRank[a.playground.name] !== undefined ? pgRank[a.playground.name] : 999;
      const bRank = pgRank[b.playground.name] !== undefined ? pgRank[b.playground.name] : 999;
      return aRank - bRank;
    }

    return timeCmp;
  });

  return candidates[0];
}

/**
 * Create a booking.
 * @param {object} params
 * @param {string} params.playgroundId
 * @param {string} params.priceId - timetableBlockPrice ID
 * @param {string} params.date - YYYY-MM-DD
 * @param {string} params.startTime - HH:MM (local time)
 * @param {number} params.duration - in minutes
 * @param {string} params.userId
 * @param {string} params.lastName
 * @param {number} params.pricePerParticipant - in cents
 * @param {number} params.maxParticipants
 */
async function createBooking({ playgroundId, priceId, date, startTime, duration, userId, lastName, pricePerParticipant, maxParticipants = 10 }) {
  // Convert local time to UTC (France is UTC+1 in winter, UTC+2 in summer)
  const startLocal = new Date(`${date}T${startTime}:00`);
  const endLocal = new Date(startLocal.getTime() + duration * 60000);

  // Format as UTC for the API
  const startUtc = toUtcString(startLocal);
  const endUtc = toUtcString(endLocal);

  const body = {
    timetableBlockPrice: `/clubs/playgrounds/timetables/blocks/prices/${priceId}`,
    activity: `/activities/${ACTIVITY_FOOTBALL_5V5}`,
    canceled: false,
    club: `/clubs/${CLUB_ID}`,
    startAt: startUtc,
    endAt: endUtc,
    name: lastName,
    playgroundOptions: [],
    playgrounds: [`/clubs/playgrounds/${playgroundId}`],
    maxParticipantsCountLimit: maxParticipants,
    userClient: `/user-clients/${userId}`,
    participants: [{
      user: `/user-clients/${userId}`,
      restToPay: pricePerParticipant,
      bookingOwner: true,
    }],
    pricePerParticipant,
    paymentMethod: 'per_participant',
    creationOrigin: 'white_label_app',
    payments: [],
  };

  const res = await authFetch(`${API_BASE}/clubs/bookings`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`createBooking failed: ${res.status} - ${text}`);
  }

  return res.json();
}

/**
 * Create a payment cart for a booking.
 * @returns {object} Cart data including id
 */
async function createPaymentCart(bookingId, price) {
  const body = {
    items: [{
      product: `/clubs/bookings/${bookingId}`,
      price,
    }],
  };

  const res = await authFetch(`${API_BASE}/payments/carts`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`createPaymentCart failed: ${res.status} - ${text}`);
  }

  return res.json();
}

/**
 * Create a payment using saved Stripe source to confirm the booking.
 * The stripeSourceId must be nested in metadata (as the mobile app does).
 * @param {string} cartId - Payment cart ID
 * @param {number} amount - Amount in cents
 * @param {string} clientId - Club client ID (not user-client)
 * @param {string} userId - User client ID
 * @returns {object} Payment data with status
 */
async function createPayment(cartId, amount, clientId, userId) {
  const { stripeSourceId } = getConfig();
  if (!stripeSourceId) {
    throw new Error('Aucun moyen de paiement trouvé — fais au moins un paiement via l\'app DoInSport');
  }

  const body = {
    amount,
    cart: `/payments/carts/${cartId}`,
    client: `/clubs/clients/${clientId}`,
    currency: 'EUR',
    method: 'card',
    provider: 'stripe',
    userClient: `/user-clients/${userId}`,
    captureMethod: null,
    metadata: { stripeSourceId },
  };

  const res = await authFetch(`${API_BASE}/payments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`createPayment failed: ${res.status} - ${text}`);
  }

  return res.json();
}

/**
 * Confirm a payment via the DoInSport API.
 * This triggers the backend to attach the Stripe source and attempt the charge.
 * After this, the payment status is typically 'processing' and needs Stripe.js confirmation.
 * @param {string} paymentId
 * @returns {object} Payment data with metadata.clientSecret
 */
async function confirmDoinsportPayment(paymentId) {
  const res = await authFetch(`${API_BASE}/payments/${paymentId}/confirm`, {
    method: 'POST',
    body: '{}',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`confirmDoinsportPayment failed: ${res.status} - ${text}`);
  }

  return res.json();
}

/**
 * Cancel a booking. If the booking had a succeeded payment, DoInSport auto-refunds.
 * @param {string} bookingId
 * @returns {object} Updated booking data
 */
async function cancelBooking(bookingId) {
  const res = await authFetch(`${API_BASE}/clubs/bookings/${bookingId}`, {
    method: 'PUT',
    body: JSON.stringify({ canceled: true }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`cancelBooking failed: ${res.status} - ${text.substring(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { canceled: true };
  }
}

/**
 * Get existing bookings from the DoInSport API.
 * Returns upcoming non-canceled bookings.
 */
async function getMyBookings() {
  const today = new Date().toISOString().split('T')[0];
  const url = `${API_BASE}/clubs/bookings?club.id=${CLUB_ID}&canceled=false&startAt[after]=${today}&order[startAt]=asc&itemsPerPage=50`;
  const res = await authFetch(url);
  if (!res.ok) {
    throw new Error(`getMyBookings failed: ${res.status}`);
  }
  const data = await res.json();
  const members = data['hydra:member'] || [];

  return members.map(b => ({
    id: b.id,
    date: b.startAt ? b.startAt.split('T')[0] : null,
    startAt: b.startAt,
    endAt: b.endAt,
    activity: b.activity?.name || 'Football 5vs5',
    playground: b.playgrounds?.[0]?.name || '-',
    price: b.price,
    pricePerParticipant: b.pricePerParticipant,
    participantsCount: b.participantsCount,
    maxParticipants: b.maxParticipantsCountLimit,
    paymentMethod: b.paymentMethod,
    confirmed: b.confirmed,
    canceled: b.canceled,
    createdAt: b.createdAt,
    restToPay: b.restToPay,
  }));
}

/**
 * Check if there's already a booking on a given date.
 */
async function hasBookingOnDate(date) {
  const bookings = await getMyBookings();
  return bookings.some(b => b.date === date);
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function toUtcString(localDate) {
  const y = localDate.getUTCFullYear();
  const mo = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(localDate.getUTCDate()).padStart(2, '0');
  const h = String(localDate.getUTCHours()).padStart(2, '0');
  const mi = String(localDate.getUTCMinutes()).padStart(2, '0');
  const s = String(localDate.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

module.exports = {
  getPlanning,
  findAllSlots,
  findBestSlot,
  createBooking,
  createPaymentCart,
  createPayment,
  confirmDoinsportPayment,
  cancelBooking,
  getMyBookings,
  hasBookingOnDate,
  CLUB_ID,
  ACTIVITY_FOOTBALL_5V5,
  CATEGORY_FOOTBALL,
  PLAYGROUNDS,
  PLAYGROUND_NAMES,
};
