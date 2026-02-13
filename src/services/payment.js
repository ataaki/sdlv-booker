/**
 * Payment Service - Centralized payment flow logic
 *
 * This service eliminates the 37-line duplication between scheduler.js and routes/api.js
 * by providing a single implementation of the payment confirmation flow.
 */

const { getConfig } = require('../api/config-resolver');
const {
  createPaymentCart,
  createPayment,
  confirmDoinsportPayment,
} = require('../api/doinsport');
const { confirmStripePayment } = require('../api/stripe-confirm');
const { extractIdOrThrow } = require('../utils/id-helpers');

/**
 * Execute complete payment flow for a booking
 *
 * This function handles the entire payment process:
 * 1. Create payment cart from booking
 * 2. Create payment with Stripe source
 * 3. Confirm payment via DoInSport API
 * 4. If needed, confirm payment via Stripe.js (handles 3DS)
 *
 * @param {object} params
 * @param {string} params.bookingId - DoInSport booking ID
 * @param {number} params.price - Price in cents
 * @param {string} params.userId - User client ID
 * @param {string} [params.context='payment'] - Context for logging (e.g., 'manual booking', 'scheduled booking')
 * @returns {Promise<object>} Payment result
 * @returns {string} return.paymentId - DoInSport payment ID
 * @returns {string} return.status - Payment status ('succeeded', 'processing', etc.)
 * @returns {boolean} return.confirmed - Whether payment was confirmed
 * @throws {Error} If payment creation or confirmation fails
 *
 * @example
 * const result = await executePaymentFlow({
 *   bookingId: 'abc123',
 *   price: 1200,  // 12.00 EUR
 *   userId: 'user-456',
 *   context: 'manual booking'
 * });
 * // => { paymentId: 'pay-789', status: 'succeeded', confirmed: true }
 */
async function executePaymentFlow({
  bookingId,
  price,
  userId,
  context = 'payment',
}) {
  try {
    console.log(`[Payment] Starting payment flow for booking ${bookingId} (${context})`);

    // Step 1: Create payment cart
    const cart = await createPaymentCart(bookingId, price);
    const cartId = extractIdOrThrow(cart, 'payment cart');
    console.log(`[Payment] Cart created: ${cartId}`);

    // Step 2: Create payment with Stripe source
    const { clubClientId } = getConfig();
    const payment = await createPayment(cartId, price, clubClientId, userId);
    const paymentId = extractIdOrThrow(payment, 'payment');
    const clientSecret = payment.metadata?.clientSecret;

    console.log(`[Payment] Payment created: ${paymentId}, status: ${payment.status}`);

    // Step 3: Confirm via DoInSport API (attaches Stripe source)
    const confirmed = await confirmDoinsportPayment(paymentId);
    console.log(`[Payment] DoInSport confirm: ${confirmed.status}`);

    // Step 4: Confirm via Stripe.js if payment not yet succeeded
    // This handles 3DS authentication frictionlessly via browser fingerprinting
    if (confirmed.status !== 'succeeded') {
      const secret = confirmed.metadata?.clientSecret || clientSecret;

      if (!secret) {
        throw new Error('No clientSecret in payment metadata');
      }

      console.log(`[Payment] Confirming via Stripe.js (status: ${confirmed.status})`);
      const stripeResult = await confirmStripePayment(secret);
      console.log(`[Payment] Stripe.js confirm: ${stripeResult.status}`);

      if (stripeResult.status !== 'succeeded') {
        throw new Error(`Stripe payment failed with status: ${stripeResult.status}`);
      }

      return {
        paymentId,
        status: 'succeeded',
        confirmed: true,
      };
    }

    // Payment succeeded via DoInSport confirmation alone
    return {
      paymentId,
      status: confirmed.status,
      confirmed: confirmed.status === 'succeeded',
    };

  } catch (err) {
    console.error(`[Payment] ${context} failed:`, err.message);
    throw err;
  }
}

module.exports = {
  executePaymentFlow,
};
