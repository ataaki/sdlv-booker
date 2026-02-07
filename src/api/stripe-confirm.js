const { chromium } = require('playwright');

const PORT = process.env.PORT || 3000;

// 3DS challenge polling config
const POLL_INTERVAL_MS = 30_000; // 30 seconds between checks
const POLL_TIMEOUT_MS = 5 * 60_000; // 5 minutes max wait

/**
 * Confirm a Stripe payment using Stripe.js in a headless browser.
 * This replicates what the DoInSport mobile app does with stripe.confirmCardPayment(),
 * which handles 3DS frictionlessly via browser fingerprinting.
 *
 * If the bank triggers a 3DS challenge (requires_action), the bot polls every 30s
 * for up to 5 minutes, waiting for the user to confirm on their banking app.
 *
 * @param {string} clientSecret - The PaymentIntent client_secret from DoInSport payment metadata
 * @returns {object} The PaymentIntent object with status 'succeeded'
 */
async function confirmStripePayment(clientSecret) {
  const { getConfig } = require('./config-resolver');
  const { stripePk: pk, stripeAccount: account, stripeSourceId: sourceId } = getConfig();

  if (!pk || !account || !sourceId) {
    throw new Error('Configuration Stripe incomplète — vérifiez que resolveConfig() a été appelé au démarrage');
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`http://localhost:${PORT}/stripe-confirm.html`, {
      waitUntil: 'networkidle',
      timeout: 15000,
    });

    // Wait for Stripe.js to be ready
    await page.waitForFunction(() => window.stripeReady === true, { timeout: 10000 });

    // Call confirmCardPayment via Stripe.js
    const result = await page.evaluate(
      async ({ pk, account, clientSecret, sourceId }) => {
        return window.confirmPayment(pk, account, clientSecret, sourceId);
      },
      { pk, account, clientSecret, sourceId }
    );

    if (result.error) {
      throw new Error(`Stripe confirmCardPayment failed: ${result.error.message}`);
    }

    // Frictionless 3DS — payment succeeded immediately
    if (result.paymentIntent?.status === 'succeeded') {
      console.log('[Stripe] Payment confirmed via Stripe.js (frictionless), status: succeeded');
      return result.paymentIntent;
    }

    // 3DS challenge triggered — poll until user confirms on banking app
    if (result.paymentIntent?.status === 'requires_action' || result.paymentIntent?.status === 'requires_confirmation') {
      console.log(`[Stripe] 3DS challenge triggered (status: ${result.paymentIntent.status}), polling for up to ${POLL_TIMEOUT_MS / 60000} minutes...`);

      const pollResult = await pollPaymentStatus(page, pk, account, clientSecret);
      return pollResult;
    }

    throw new Error(`Payment not succeeded: ${result.paymentIntent?.status}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Poll the PaymentIntent status via Stripe.js until it succeeds or times out.
 */
async function pollPaymentStatus(page, pk, account, clientSecret) {
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    attempt++;
    await sleep(POLL_INTERVAL_MS);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Stripe] 3DS poll attempt #${attempt} (${elapsed}s elapsed)...`);

    const result = await page.evaluate(
      async ({ pk, account, clientSecret }) => {
        return window.retrievePayment(pk, account, clientSecret);
      },
      { pk, account, clientSecret }
    );

    if (result.error) {
      console.log(`[Stripe] Poll error: ${result.error.message}`);
      continue;
    }

    const status = result.paymentIntent?.status;
    console.log(`[Stripe] Poll result: ${status}`);

    if (status === 'succeeded') {
      console.log('[Stripe] Payment confirmed after 3DS challenge, status: succeeded');
      return result.paymentIntent;
    }

    if (status === 'canceled' || status === 'requires_payment_method') {
      throw new Error(`Payment failed after 3DS challenge: ${status}`);
    }

    // Still requires_action or processing — keep polling
  }

  throw new Error(`3DS challenge timeout: user did not confirm within ${POLL_TIMEOUT_MS / 60000} minutes`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { confirmStripePayment };
