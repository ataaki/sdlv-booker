# Retry sur absence de slots — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-rule retry with progressive delay escalation when no slots are available (`no_slots`).

**Architecture:** A `retry_config` JSON column on `booking_rules` stores escalation steps. A `retry_queue` table tracks active retries. The existing per-minute cron processes pending retries alongside normal scheduling.

**Tech Stack:** Node.js/Express backend (CommonJS), SQLite via better-sqlite3, React 19 + TypeScript + Tailwind CSS 4 frontend.

---

### Task 1: Backend — Constants & Retry Status

**Files:**
- Modify: `src/constants.js:44-52`

**Step 1: Add RETRY_STATUS constants**

In `src/constants.js`, add after the `BOOKING_STATUS` object (line 52):

```javascript
// Retry Queue Status
const RETRY_STATUS = {
  ACTIVE: 'active',
  SUCCESS: 'success',
  EXHAUSTED: 'exhausted',
  CANCELLED: 'cancelled',
};
```

**Step 2: Export RETRY_STATUS**

Add `RETRY_STATUS` to the module.exports in `src/constants.js`.

**Step 3: Commit**

```
git add src/constants.js
git commit -m "feat(retry): add RETRY_STATUS constants"
```

---

### Task 2: Backend — Database Migration & CRUD

**Files:**
- Modify: `src/db/database.js`

**Step 1: Add migration v3**

Append to the `MIGRATIONS` array (after the v2 entry at line 34):

```javascript
  // v3: add retry_config column to booking_rules + retry_queue table
  () => {
    const cols = db.pragma('table_info(booking_rules)');
    if (!cols.some(c => c.name === 'retry_config')) {
      db.exec('ALTER TABLE booking_rules ADD COLUMN retry_config TEXT DEFAULT NULL');
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS retry_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id INTEGER NOT NULL,
        target_date TEXT NOT NULL,
        target_time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        activity TEXT NOT NULL,
        playground_order TEXT,
        retry_config TEXT NOT NULL,
        current_step INTEGER NOT NULL DEFAULT 0,
        attempts_in_step INTEGER NOT NULL DEFAULT 0,
        total_attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (rule_id) REFERENCES booking_rules(id)
      )
    `);
  },
```

**Step 2: Update `createRule` to accept `retry_config`**

Modify the `createRule` function (line 110) to accept and store `retry_config`:

```javascript
function createRule({ day_of_week, target_time, trigger_time = '00:00', duration = 60, activity = 'football_5v5', playground_order = null, retry_config = null }) {
  const pgOrder = playground_order ? JSON.stringify(playground_order) : null;
  const retryJson = retry_config ? JSON.stringify(retry_config) : null;
  const stmt = getDb().prepare(
    'INSERT INTO booking_rules (day_of_week, target_time, trigger_time, duration, activity, playground_order, retry_config) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(day_of_week, target_time, trigger_time, duration, activity, pgOrder, retryJson);
  return getRuleById(result.lastInsertRowid);
}
```

**Step 3: Update `updateRule` to accept `retry_config`**

In the `updateRule` function (line 119), add `retry_config` to the destructured parameter and add the field handling:

```javascript
function updateRule(id, { day_of_week, target_time, trigger_time, duration, enabled, playground_order, retry_config }) {
  const fields = [];
  const values = [];

  if (day_of_week !== undefined) { fields.push('day_of_week = ?'); values.push(day_of_week); }
  if (target_time !== undefined) { fields.push('target_time = ?'); values.push(target_time); }
  if (trigger_time !== undefined) { fields.push('trigger_time = ?'); values.push(trigger_time); }
  if (duration !== undefined) { fields.push('duration = ?'); values.push(duration); }
  if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled ? 1 : 0); }
  if (playground_order !== undefined) { fields.push('playground_order = ?'); values.push(playground_order ? JSON.stringify(playground_order) : null); }
  if (retry_config !== undefined) { fields.push('retry_config = ?'); values.push(retry_config ? JSON.stringify(retry_config) : null); }

  if (fields.length === 0) return getRuleById(id);

  values.push(id);
  getDb().prepare(`UPDATE booking_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getRuleById(id);
}
```

**Step 4: Add retry_queue CRUD functions**

Add before `module.exports`:

```javascript
// --- Retry Queue ---

function getActiveRetries() {
  return getDb().prepare(
    "SELECT * FROM retry_queue WHERE status = 'active' ORDER BY next_retry_at"
  ).all();
}

function getDueRetries(nowIso) {
  return getDb().prepare(
    "SELECT * FROM retry_queue WHERE status = 'active' AND next_retry_at <= ? ORDER BY next_retry_at"
  ).all(nowIso);
}

function getActiveRetryForRule(ruleId, targetDate) {
  return getDb().prepare(
    "SELECT * FROM retry_queue WHERE rule_id = ? AND target_date = ? AND status = 'active'"
  ).get(ruleId, targetDate);
}

function createRetryEntry({ rule_id, target_date, target_time, duration, activity, playground_order, retry_config, next_retry_at }) {
  const stmt = getDb().prepare(
    `INSERT INTO retry_queue (rule_id, target_date, target_time, duration, activity, playground_order, retry_config, next_retry_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(rule_id, target_date, target_time, duration, activity, playground_order, JSON.stringify(retry_config), next_retry_at);
  return getDb().prepare('SELECT * FROM retry_queue WHERE id = ?').get(result.lastInsertRowid);
}

function updateRetryEntry(id, { current_step, attempts_in_step, total_attempts, next_retry_at, status }) {
  const fields = [];
  const values = [];

  if (current_step !== undefined) { fields.push('current_step = ?'); values.push(current_step); }
  if (attempts_in_step !== undefined) { fields.push('attempts_in_step = ?'); values.push(attempts_in_step); }
  if (total_attempts !== undefined) { fields.push('total_attempts = ?'); values.push(total_attempts); }
  if (next_retry_at !== undefined) { fields.push('next_retry_at = ?'); values.push(next_retry_at); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }

  if (fields.length === 0) return;

  values.push(id);
  getDb().prepare(`UPDATE retry_queue SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function cancelRetryEntry(id) {
  getDb().prepare("UPDATE retry_queue SET status = 'cancelled' WHERE id = ? AND status = 'active'").run(id);
}

function getRetryById(id) {
  return getDb().prepare('SELECT * FROM retry_queue WHERE id = ?').get(id);
}
```

**Step 5: Export new functions**

Add to `module.exports`:
```
  getActiveRetries, getDueRetries, getActiveRetryForRule,
  createRetryEntry, updateRetryEntry, cancelRetryEntry, getRetryById,
```

**Step 6: Commit**

```
git add src/db/database.js
git commit -m "feat(retry): add migration v3, retry_queue table, and CRUD functions"
```

---

### Task 3: Backend — Validation

**Files:**
- Modify: `src/utils/validators.js`

**Step 1: Add `validateRetryConfig` function**

Add before `module.exports`:

```javascript
function validateRetryConfig(config) {
  if (config === null || config === undefined) return null;

  if (!Array.isArray(config)) {
    return 'retry_config must be an array';
  }

  if (config.length === 0) {
    return 'retry_config must have at least one step';
  }

  for (let i = 0; i < config.length; i++) {
    const step = config[i];
    if (typeof step !== 'object' || step === null) {
      return `retry_config[${i}] must be an object`;
    }
    if (typeof step.count !== 'number' || step.count < 0 || !Number.isInteger(step.count)) {
      return `retry_config[${i}].count must be a non-negative integer (0 = infinite)`;
    }
    if (typeof step.delay_minutes !== 'number' || step.delay_minutes < 1 || !Number.isInteger(step.delay_minutes)) {
      return `retry_config[${i}].delay_minutes must be a positive integer`;
    }
  }

  return null;
}
```

**Step 2: Export `validateRetryConfig`**

Add `validateRetryConfig` to the module.exports.

**Step 3: Commit**

```
git add src/utils/validators.js
git commit -m "feat(retry): add validateRetryConfig validator"
```

---

### Task 4: Backend — API Routes

**Files:**
- Modify: `src/routes/api.js`

**Step 1: Update validator import**

At line 10, add `validateRetryConfig` to the destructured import:
```javascript
const { validateTimeFormat, validateDuration, validateBookingRule, validateBookingAdvanceDays, validateRetryConfig } = require('../utils/validators');
```

**Step 2: Update POST /rules to accept retry_config**

Replace the `POST /rules` handler:

```javascript
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
```

**Step 3: Update PUT /rules/:id to validate retry_config**

In the `PUT /rules/:id` handler, after the `validateBookingRule` errors check, add:

```javascript
  if (req.body.retry_config !== undefined) {
    const retryError = validateRetryConfig(req.body.retry_config);
    if (retryError) return validationError(res, retryError);
  }
```

**Step 4: Add retry queue endpoints**

Add after the `/rules/:id` DELETE route:

```javascript
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
```

**Step 5: Update GET /dashboard to include active retries and retry_config**

In the `rulesWithInfo` map callback, add `retry_config` parsing:
```javascript
    retry_config: rule.retry_config ? JSON.parse(rule.retry_config) : null,
```

After `const creds = db.getCredentials();`, add:
```javascript
  const activeRetries = db.getActiveRetries().map(r => ({
    ...r,
    retry_config: JSON.parse(r.retry_config),
    playground_order: r.playground_order ? JSON.parse(r.playground_order) : null,
  }));
```

Add `active_retries: activeRetries` to the response JSON object.

**Step 6: Commit**

```
git add src/routes/api.js
git commit -m "feat(retry): add retry_config to rules CRUD and retry queue endpoints"
```

---

### Task 5: Backend — Scheduler Retry Logic

**Files:**
- Modify: `src/scheduler/scheduler.js`

**Step 1: Update imports**

Replace the imports at the top to add needed functions:

```javascript
const cron = require('node-cron');
const { getEnabledRules, getSetting, getCredentials, getDueRetries, createRetryEntry, updateRetryEntry, getActiveRetryForRule } = require('../db/database');
const { DAY_NAMES, DEFAULT_BOOKING_ADVANCE_DAYS, RETRY_STATUS } = require('../constants');
const { parsePlaygroundOrder } = require('../utils/json-helpers');
const { findAndBookSlot, checkExistingBooking } = require('../services/booking');
const { executePaymentFlow } = require('../services/payment');
const { cancelBooking } = require('../api/doinsport');
const { logSuccess, logFailure, logPaymentFailure, logCancellation, logNoSlots, logSkipped } = require('../services/logging');
```

**Step 2: Add `enqueueRetry` function**

Add after the `executeBooking` function:

```javascript
function enqueueRetry(rule, targetDate) {
  const retryConfig = rule.retry_config ? (typeof rule.retry_config === 'string' ? JSON.parse(rule.retry_config) : rule.retry_config) : null;
  if (!retryConfig || retryConfig.length === 0) return;

  const existing = getActiveRetryForRule(rule.id, targetDate);
  if (existing) {
    console.log(`[Retry] Already queued for rule #${rule.id} on ${targetDate}`);
    return;
  }

  const firstStep = retryConfig[0];
  const nextRetry = new Date(Date.now() + firstStep.delay_minutes * 60_000);

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
```

**Step 3: Add `advanceRetry` function**

```javascript
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
  const nextRetryAt = new Date(Date.now() + delayMinutes * 60_000).toISOString();

  updateRetryEntry(retry.id, {
    current_step: nextStep,
    attempts_in_step: nextAttemptsInStep,
    total_attempts: newTotalAttempts,
    next_retry_at: nextRetryAt,
  });

  console.log(`[Retry] Next attempt for rule #${retry.rule_id} at ${nextRetryAt} (step ${nextStep + 1}/${retryConfig.length}, attempt ${nextAttemptsInStep + 1}/${retryConfig[nextStep].count || 'inf'})`);
}
```

**Step 4: Add `processRetries` function**

```javascript
async function processRetries() {
  const now = new Date();
  const dueRetries = getDueRetries(now.toISOString());
  if (dueRetries.length === 0) return;

  console.log(`[Retry] Processing ${dueRetries.length} due retry(ies)...`);

  for (const retry of dueRetries) {
    try {
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
```

**Step 5: Update `executeBooking` to enqueue retry on no_slots**

In the `executeBooking` function, find the `if (!bookingResult)` block and add `enqueueRetry(rule, targetDate);` before the return:

```javascript
    if (!bookingResult) {
      logNoSlots({
        ruleId: rule.id,
        targetDate,
        targetTime: rule.target_time,
      });
      enqueueRetry(rule, targetDate);
      return { status: 'no_slots' };
    }
```

**Step 6: Update `startScheduler` cron to call `processRetries`**

In the cron callback inside `startScheduler`, add after the `runScheduledBookings` try/catch:

```javascript
    try {
      await processRetries();
    } catch (err) {
      console.error(`[Retry] Error in retry processing: ${err.message}`);
    }
```

**Step 7: Export new functions**

Add `enqueueRetry` and `processRetries` to `module.exports`.

**Step 8: Commit**

```
git add src/scheduler/scheduler.js
git commit -m "feat(retry): add retry queue processing to scheduler"
```

---

### Task 6: Frontend — Types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Step 1: Add retry types after J45Info**

```typescript
export interface RetryStep {
  count: number
  delay_minutes: number
}

export interface RetryQueueEntry {
  id: number
  rule_id: number
  target_date: string
  target_time: string
  duration: number
  activity: string
  playground_order: string[] | null
  retry_config: RetryStep[]
  current_step: number
  attempts_in_step: number
  total_attempts: number
  next_retry_at: string
  status: 'active' | 'success' | 'exhausted' | 'cancelled'
  created_at: string
}
```

**Step 2: Add `retry_config` to the Rule interface**

```typescript
  retry_config: RetryStep[] | null
```

**Step 3: Add `active_retries` to DashboardData**

```typescript
  active_retries: RetryQueueEntry[]
```

**Step 4: Commit**

```
git add frontend/src/types/index.ts
git commit -m "feat(retry): add retry TypeScript types"
```

---

### Task 7: Frontend — RetryStepsEditor Component

**Files:**
- Create: `frontend/src/components/rules/RetryStepsEditor.tsx`

**Step 1: Create the component**

```tsx
import type { RetryStep } from '../../types'

interface RetryStepsEditorProps {
  steps: RetryStep[]
  onChange: (steps: RetryStep[]) => void
}

const UNIT_OPTIONS = [
  { value: 1, label: 'min' },
  { value: 60, label: 'h' },
]

function delayToUnitValue(delayMinutes: number): { value: number; unit: number } {
  if (delayMinutes >= 60 && delayMinutes % 60 === 0) {
    return { value: delayMinutes / 60, unit: 60 }
  }
  return { value: delayMinutes, unit: 1 }
}

function formatStepSummary(step: RetryStep): string {
  const { value, unit } = delayToUnitValue(step.delay_minutes)
  const unitLabel = unit === 60 ? 'h' : 'min'
  const countLabel = step.count === 0 ? 'retry indefiniment' : `${step.count} tentative${step.count > 1 ? 's' : ''}`
  return `${countLabel} toutes les ${value} ${unitLabel}`
}

export default function RetryStepsEditor({ steps, onChange }: RetryStepsEditorProps) {
  function updateStep(index: number, field: 'count' | 'delay_minutes', value: number) {
    const updated = [...steps]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  function updateStepDelay(index: number, value: number, unit: number) {
    const updated = [...steps]
    updated[index] = { ...updated[index], delay_minutes: value * unit }
    onChange(updated)
  }

  function addStep() {
    onChange([...steps, { count: 5, delay_minutes: 5 }])
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const { value: delayValue, unit: delayUnit } = delayToUnitValue(step.delay_minutes)
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="number"
                min={0}
                value={step.count}
                onChange={(e) => updateStep(i, 'count', Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 px-2 py-1.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                title="Nombre de tentatives (0 = infini)"
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {step.count === 0 ? '(inf)' : 'x'}
              </span>
              <span className="text-xs text-slate-500 whitespace-nowrap">toutes les</span>
              <input
                type="number"
                min={1}
                value={delayValue}
                onChange={(e) => updateStepDelay(i, Math.max(1, parseInt(e.target.value) || 1), delayUnit)}
                className="w-16 px-2 py-1.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
              <select
                value={delayUnit}
                onChange={(e) => updateStepDelay(i, delayValue, parseInt(e.target.value))}
                className="px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            {steps.length > 1 && (
              <button
                type="button"
                onClick={() => removeStep(i)}
                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                title="Supprimer cette etape"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={addStep}
        className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium transition-colors"
      >
        + Ajouter une etape
      </button>

      {steps.length > 0 && (
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
          {steps.map(formatStepSummary).join(', puis ')}
        </p>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```
git add frontend/src/components/rules/RetryStepsEditor.tsx
git commit -m "feat(retry): create RetryStepsEditor component"
```

---

### Task 8: Frontend — Update RuleForm

**Files:**
- Modify: `frontend/src/components/rules/RuleForm.tsx`

**Step 1: Add imports**

Add `RetryStep` to the type import and import the new component:
```typescript
import type { Rule, DashboardConfig, RetryStep } from '../../types'
import RetryStepsEditor from './RetryStepsEditor'
```

**Step 2: Add retry state variables**

After the `playgroundOrder` state, add:
```typescript
  const [retryEnabled, setRetryEnabled] = useState(false)
  const [retrySteps, setRetrySteps] = useState<RetryStep[]>([{ count: 5, delay_minutes: 5 }])
```

**Step 3: Update useEffect to load/reset retry state**

In the `if (rule)` branch, add:
```typescript
      if (rule.retry_config && rule.retry_config.length > 0) {
        setRetryEnabled(true)
        setRetrySteps(rule.retry_config)
      } else {
        setRetryEnabled(false)
        setRetrySteps([{ count: 5, delay_minutes: 5 }])
      }
```

In the `else` branch, add:
```typescript
      setRetryEnabled(false)
      setRetrySteps([{ count: 5, delay_minutes: 5 }])
```

**Step 4: Update onSave prop type**

```typescript
  onSave: (data: {
    day_of_week: number; target_time: string; trigger_time: string; duration: number;
    playground_order: string[] | null; retry_config: RetryStep[] | null
  }) => Promise<void>
```

**Step 5: Update handleSave to include retry_config**

```typescript
      await onSave({
        day_of_week: dayOfWeek,
        target_time: targetTime,
        trigger_time: triggerTime,
        duration,
        playground_order: playgroundOrder.length > 0 ? playgroundOrder : null,
        retry_config: retryEnabled ? retrySteps : null,
      })
```

**Step 6: Add retry section in JSX after playground prefs**

After the playground prefs `</div>`, add:

```tsx
              <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500">
                    Retry si aucun slot disponible
                  </label>
                  <button
                    type="button"
                    onClick={() => setRetryEnabled(!retryEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${retryEnabled ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${retryEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {retryEnabled && (
                  <RetryStepsEditor steps={retrySteps} onChange={setRetrySteps} />
                )}
              </div>
```

**Step 7: Commit**

```
git add frontend/src/components/rules/RuleForm.tsx
git commit -m "feat(retry): add retry config section to RuleForm"
```

---

### Task 9: Frontend — Update RuleCard with Retry Badge

**Files:**
- Modify: `frontend/src/components/rules/RuleCard.tsx`

**Step 1: Update imports and props**

```typescript
import type { Rule, RetryQueueEntry } from '../../types'

interface RuleCardProps {
  rule: Rule
  activeRetry?: RetryQueueEntry | null
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  onToggle: (id: number, enabled: boolean) => void
  onBookNow: (id: number, date: string) => void
  onCancelRetry?: (retryId: number) => void
  bookingLoading?: boolean
}
```

**Step 2: Update component destructuring**

```typescript
export default function RuleCard({ rule, activeRetry, onEdit, onDelete, onToggle, onBookNow, onCancelRetry, bookingLoading }: RuleCardProps) {
```

**Step 3: Add retry badge JSX**

After the J-45 info bar div (the last `<div>` inside the card), add:

```tsx
      {activeRetry && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border-t border-amber-200 dark:border-amber-500/20 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            Retry en cours — tentative {activeRetry.total_attempts + 1}
            {activeRetry.retry_config[activeRetry.current_step]?.count > 0
              ? `/${activeRetry.retry_config[activeRetry.current_step].count}`
              : ''
            }
            {activeRetry.retry_config.length > 1
              ? ` (etape ${activeRetry.current_step + 1}/${activeRetry.retry_config.length})`
              : ''
            }
          </span>
          {onCancelRetry && (
            <button
              onClick={() => onCancelRetry(activeRetry.id)}
              className="text-xs text-amber-600 dark:text-amber-400 hover:text-red-500 font-medium transition-colors"
            >
              Annuler
            </button>
          )}
        </div>
      )}
```

**Step 4: Commit**

```
git add frontend/src/components/rules/RuleCard.tsx
git commit -m "feat(retry): add active retry badge to RuleCard"
```

---

### Task 10: Frontend — Update use-rules hook

**Files:**
- Modify: `frontend/src/hooks/use-rules.ts`

**Step 1: Update RuleInput and add cancelRetry**

```typescript
import type { BookResult, RetryStep } from '../types'

interface RuleInput {
  day_of_week: number
  target_time: string
  trigger_time: string
  duration: number
  playground_order: string[] | null
  retry_config: RetryStep[] | null
}
```

Add the `cancelRetry` function inside the hook:
```typescript
  const cancelRetry = useCallback(async (retryId: number) => {
    return api.delete(`/retries/${retryId}`)
  }, [])
```

Update the return: `return { createRule, updateRule, deleteRule, toggleRule, bookNow, cancelRetry }`

**Step 2: Commit**

```
git add frontend/src/hooks/use-rules.ts
git commit -m "feat(retry): update use-rules hook with retry_config and cancelRetry"
```

---

### Task 11: Frontend — Update App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Update handleSaveRule type**

Update the type for the `data` parameter of `handleSaveRule` to include `retry_config`:

```typescript
  const handleSaveRule = useCallback(async (data: {
    day_of_week: number; target_time: string; trigger_time: string; duration: number;
    playground_order: string[] | null; retry_config: import('./types').RetryStep[] | null
  }) => {
```

**Step 2: Add handleCancelRetry**

After `handleBookNow`:

```typescript
  const handleCancelRetry = useCallback(async (retryId: number) => {
    try {
      await rules.cancelRetry(retryId)
      toast('success', 'Retry annule')
      await dashboard.refresh()
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur inconnue')
    }
  }, [rules, dashboard, toast])
```

**Step 3: Update RuleCard props in JSX**

Add `activeRetry` and `onCancelRetry` props to each `<RuleCard>`:

```tsx
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  activeRetry={dashData.active_retries?.find(r => r.rule_id === rule.id && r.status === 'active') ?? null}
                  onEdit={handleEditRule}
                  onDelete={(id) => {
                    const r = dashData.rules.find((x) => x.id === id)
                    if (r) setDeleteRuleTarget(r)
                  }}
                  onToggle={handleToggleRule}
                  onBookNow={handleBookNow}
                  onCancelRetry={handleCancelRetry}
                  bookingLoading={bookNowRuleId === rule.id}
                />
```

**Step 4: Commit**

```
git add frontend/src/App.tsx
git commit -m "feat(retry): wire up retry in App.tsx"
```

---

### Task 12: Build & Manual Test

**Step 1: Build frontend**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no TypeScript errors.

**Step 2: Start the server**

Run: `node src/server.js`
Expected: Server starts, migration v3 runs.

**Step 3: Verify in browser**

- Open the app
- Edit a rule, enable retry, configure steps, save
- Check rule card displays correctly
- Trigger a booking to verify no regressions

**Step 4: Final commit if needed**

---

## Summary

| File | Action |
|------|--------|
| `src/constants.js` | Add `RETRY_STATUS` |
| `src/db/database.js` | Migration v3, retry_queue CRUD, update createRule/updateRule |
| `src/utils/validators.js` | Add `validateRetryConfig` |
| `src/routes/api.js` | Update rules CRUD, add retry endpoints, update dashboard |
| `src/scheduler/scheduler.js` | Add retry processing logic |
| `frontend/src/types/index.ts` | Add `RetryStep`, `RetryQueueEntry`, update `Rule` + `DashboardData` |
| `frontend/src/components/rules/RetryStepsEditor.tsx` | **New** |
| `frontend/src/components/rules/RuleForm.tsx` | Add retry config section |
| `frontend/src/components/rules/RuleCard.tsx` | Add retry badge |
| `frontend/src/hooks/use-rules.ts` | Add `retry_config` + `cancelRetry` |
| `frontend/src/App.tsx` | Wire up retry props |
