# Telegram Notifications — Design Document

**Date:** 2026-02-13
**Approach:** Direct Telegram Bot API integration in the logging service

## Overview

Send a Telegram notification after every booking attempt (success, failure, no slots, skipped, payment failure, cancellation). Configuration (bot token + chat ID) is stored in the `settings` table and managed via the existing settings panel in the frontend.

## Architecture

### 1. Telegram Service (`src/services/telegram.js`)

Single module with two exports:

- `notify(logEntry)` — sends a formatted message to Telegram
- `sendTestMessage()` — sends a test message (used by the test endpoint)

Behavior:

- Reads `telegram_bot_token` and `telegram_chat_id` from `db.getSetting()`
- If either is missing, returns silently (no-op)
- Calls `https://api.telegram.org/bot<token>/sendMessage` with `parse_mode: HTML`
- Fire-and-forget: caller does not `await`, errors are caught and logged to console only
- Never throws, never blocks the booking flow

### 2. Message Format

Multi-line plain text with HTML bold for the status header.

**Success example:**
```
<b>Reservation confirmee</b>

Terrain : Foot 3
Date : Lun 31/03/2026
Heure : 19h00 (cible : 19h00)
Duree : 60 min
```

**Failure example:**
```
<b>Reservation echouee</b>

Date : Lun 31/03/2026
Heure cible : 19h00
Erreur : No available slots found
```

Status labels mapping:
- `success` → "Reservation confirmee"
- `failed` → "Reservation echouee"
- `no_slots` → "Aucun creneau disponible"
- `skipped` → "Reservation ignoree"
- `payment_failed` → "Paiement echoue"
- `cancelled` → "Reservation annulee"

### 3. Integration Point (`src/services/logging.js`)

Each logging function (`logSuccess`, `logFailure`, `logNoSlots`, `logSkipped`, `logPaymentFailure`, `logCancellation`) calls `notify()` after inserting the database log. The call is fire-and-forget (no `await`).

The `logEntry` object passed to `notify()` contains the same fields as the database insert: `targetDate`, `targetTime`, `bookedTime`, `playground`, `status`, `errorMessage`.

### 4. Settings Routes (`src/routes/api.js`)

Extend the existing settings endpoints:

- `GET /settings` — add `telegram_bot_token` and `telegram_chat_id` to the response (token is masked in the response: only last 4 chars visible)
- `PUT /settings` — accept `telegram_bot_token` and `telegram_chat_id` keys, store via `db.setSetting()`
- `POST /telegram/test` — new endpoint that calls `sendTestMessage()` and returns success/error

### 5. Frontend — Settings Panel (`App.tsx`)

Add a "Telegram" section in the existing settings modal, below the credentials fields:

- Text input: "Token du bot" (password-masked, placeholder with instructions)
- Text input: "Chat ID"
- Button: "Tester" — calls `POST /api/telegram/test`, shows toast on success/error
- Both fields saved alongside credentials via the existing save flow

### 6. No New Dependencies

The Telegram Bot API is a simple HTTPS POST. Use Node.js built-in `fetch` (available in Node 18+). No npm packages needed.
