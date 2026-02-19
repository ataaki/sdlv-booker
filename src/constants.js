/**
 * Centralized constants for the Foot Du Lundi application
 * Single source of truth for all configuration values
 */

// API Configuration
const API_BASE = 'https://api-v3.doinsport.club';
const CLUB_ID = '1ce2c55d-6010-4f45-9b6f-1aafc04382fa';

// Activity & Category IDs
const ACTIVITY_FOOTBALL_5V5 = 'cc4da804-1ef4-4f57-9fa4-4c203cdc06c8';
const CATEGORY_FOOTBALL = '910503af-d67a-4f2b-a0df-838e0b4fb8ac';

// Playgrounds
const PLAYGROUNDS = {
  'Foot 1': 'b5a0b1d1-8272-4fd0-9618-ab878c08ec7e',
  'Foot 2': 'a7724c1d-8a2f-4f43-906c-bc6ccefc2b4c',
  'Foot 3': '0111e443-e79c-4fee-87d2-4ddc329e1f5b',
  'Foot 4': '5fdabcc0-07a0-4ff9-93f5-bf5855eed3b3',
  'Foot 5': '6bbe9dd0-7073-4fbe-bf41-a06425cb5a9f',
  'Foot 6': '05e9bb22-5b63-4fd2-a720-db7715fe96a8',
  'Foot 7': '282f45b9-5786-4f82-90d5-ef07d7eeeffb',
};

const PLAYGROUND_NAMES = ['Foot 1', 'Foot 2', 'Foot 3', 'Foot 4', 'Foot 5', 'Foot 6', 'Foot 7'];

// Booking Configuration
const VALID_DURATIONS = [60, 90, 120];
const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Stripe Configuration
const DOINSPORT_STRIPE_PK = 'pk_live_ASS1268VW0gTF0hTkEs9Cno1003DMFnhdw';

// Stripe Payment Polling
const STRIPE_POLL_INTERVAL_MS = 30_000;  // 30 seconds between checks
const STRIPE_POLL_TIMEOUT_MS = 5 * 60_000;  // 5 minutes max wait

// Booking Defaults
const DEFAULT_BOOKING_ADVANCE_DAYS = 45;
const DEFAULT_DURATION = 60;
const DEFAULT_LOG_LIMIT = 50;

// Status Values
const BOOKING_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  NO_SLOTS: 'no_slots',
  PENDING: 'pending',
  SKIPPED: 'skipped',
  PAYMENT_FAILED: 'payment_failed',
  CANCELLED: 'cancelled',
};

// Retry Queue Status
const RETRY_STATUS = {
  ACTIVE: 'active',
  SUCCESS: 'success',
  EXHAUSTED: 'exhausted',
  CANCELLED: 'cancelled',
};

// Activity Type
const ACTIVITY_TYPE = 'football_5v5';

module.exports = {
  // API
  API_BASE,
  CLUB_ID,

  // Activities
  ACTIVITY_FOOTBALL_5V5,
  CATEGORY_FOOTBALL,
  ACTIVITY_TYPE,

  // Playgrounds
  PLAYGROUNDS,
  PLAYGROUND_NAMES,

  // Booking
  VALID_DURATIONS,
  DAY_NAMES,
  DEFAULT_BOOKING_ADVANCE_DAYS,
  DEFAULT_DURATION,
  DEFAULT_LOG_LIMIT,

  // Stripe
  DOINSPORT_STRIPE_PK,
  STRIPE_POLL_INTERVAL_MS,
  STRIPE_POLL_TIMEOUT_MS,

  // Status
  BOOKING_STATUS,
  RETRY_STATUS,
};
