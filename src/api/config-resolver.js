/**
 * Auto-resolve Stripe and club configuration from the DoInSport API.
 * The user only needs to provide DOINSPORT_EMAIL and DOINSPORT_PASSWORD.
 */
const { getToken } = require('./auth');

const API_BASE = 'https://api-v3.doinsport.club';
const CLUB_ID = '1ce2c55d-6010-4f45-9b6f-1aafc04382fa';

// DoInSport platform Stripe publishable key (same for all clubs — public by design)
const DOINSPORT_STRIPE_PK = 'pk_live_ASS1268VW0gTF0hTkEs9Cno1003DMFnhdw';

let resolvedConfig = null;

async function authFetch(url) {
  const token = await getToken();
  return fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/ld+json',
    },
  });
}

/**
 * Resolve all config from the DoInSport API.
 * Called once at server startup.
 */
async function resolveConfig() {
  if (resolvedConfig) return resolvedConfig;

  console.log('[Config] Resolving Stripe & club configuration from DoInSport API...');

  // 1. Get Stripe connected account from club info
  const clubRes = await authFetch(`${API_BASE}/clubs/${CLUB_ID}`);
  if (!clubRes.ok) throw new Error(`Failed to fetch club info: ${clubRes.status}`);
  const club = await clubRes.json();
  const stripeAccount = club.stripeAccountReference;
  if (!stripeAccount) throw new Error('Club has no stripeAccountReference');
  console.log(`[Config] STRIPE_ACCOUNT: ${stripeAccount}`);

  // 2. Get club client ID
  const clientsRes = await authFetch(`${API_BASE}/clubs/clients?club.id=${CLUB_ID}`);
  if (!clientsRes.ok) throw new Error(`Failed to fetch club clients: ${clientsRes.status}`);
  const clients = await clientsRes.json();
  const members = clients['hydra:member'] || [];
  if (members.length === 0) throw new Error('No club client found — make sure you have an account at this club');
  const clubClientId = members[0].id;
  console.log(`[Config] CLUB_CLIENT_ID: ${clubClientId}`);

  // 3. Get Stripe source ID from most recent payment metadata
  let stripeSourceId = null;
  const paymentsRes = await authFetch(`${API_BASE}/payments?club.id=${CLUB_ID}&itemsPerPage=10&order[createdAt]=desc`);
  if (paymentsRes.ok) {
    const payments = await paymentsRes.json();
    const paymentMembers = payments['hydra:member'] || [];
    for (const payment of paymentMembers) {
      if (payment.metadata?.stripeSourceId) {
        stripeSourceId = payment.metadata.stripeSourceId;
        break;
      }
    }
  }

  if (stripeSourceId) {
    console.log(`[Config] STRIPE_SOURCE_ID: ${stripeSourceId}`);
  } else {
    console.warn('[Config] STRIPE_SOURCE_ID: not found — you need at least one past payment via the DoInSport app');
  }

  resolvedConfig = {
    stripePk: DOINSPORT_STRIPE_PK,
    stripeAccount,
    stripeSourceId,
    clubClientId,
  };

  return resolvedConfig;
}

/**
 * Get the resolved config (must call resolveConfig first).
 */
function getConfig() {
  if (!resolvedConfig) {
    throw new Error('Config not resolved yet — call resolveConfig() at startup');
  }
  return resolvedConfig;
}

module.exports = { resolveConfig, getConfig, CLUB_ID };
