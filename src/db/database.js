const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/bookings.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

// Ordered list of migrations. Each entry runs once, tracked by schema_version.
// NEVER reorder or remove entries — only append new ones.
const MIGRATIONS = [
  // v1: add playground_order column
  () => {
    const cols = db.pragma('table_info(booking_rules)');
    if (!cols.some(c => c.name === 'playground_order')) {
      db.exec('ALTER TABLE booking_rules ADD COLUMN playground_order TEXT');
    }
  },
  // v2: add trigger_time column
  () => {
    const cols = db.pragma('table_info(booking_rules)');
    if (!cols.some(c => c.name === 'trigger_time')) {
      db.exec("ALTER TABLE booking_rules ADD COLUMN trigger_time TEXT NOT NULL DEFAULT '00:00'");
    }
  },
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
];

function initSchema() {
  // Base tables (uses db.exec for DDL statements — no user input involved)
  db.exec(`
    CREATE TABLE IF NOT EXISTS booking_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL,
      target_time TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 60,
      activity TEXT NOT NULL DEFAULT 'football_5v5',
      playground_order TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS booking_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER,
      target_date TEXT NOT NULL,
      target_time TEXT NOT NULL,
      booked_time TEXT,
      playground TEXT,
      status TEXT NOT NULL,
      booking_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (rule_id) REFERENCES booking_rules(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  // Run pending migrations
  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get();
  const currentVersion = row?.v ?? 0;

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    console.log(`[DB] Running migration v${i + 1}...`);
    MIGRATIONS[i]();
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(i + 1);
  }

  // Seed default settings
  const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('booking_advance_days');
  if (!existing) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('booking_advance_days', '45');
  }
  const existingTz = db.prepare('SELECT value FROM settings WHERE key = ?').get('timezone');
  if (!existingTz) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('timezone', 'Europe/Paris');
  }
}

// --- Booking Rules ---

function getAllRules() {
  return getDb().prepare('SELECT * FROM booking_rules ORDER BY day_of_week, target_time').all();
}

function getEnabledRules() {
  return getDb().prepare('SELECT * FROM booking_rules WHERE enabled = 1 ORDER BY day_of_week, target_time').all();
}

function getRuleById(id) {
  return getDb().prepare('SELECT * FROM booking_rules WHERE id = ?').get(id);
}

function createRule({ day_of_week, target_time, trigger_time = '00:00', duration = 60, activity = 'football_5v5', playground_order = null, retry_config = null }) {
  const pgOrder = playground_order ? JSON.stringify(playground_order) : null;
  const retryJson = retry_config ? JSON.stringify(retry_config) : null;
  const stmt = getDb().prepare(
    'INSERT INTO booking_rules (day_of_week, target_time, trigger_time, duration, activity, playground_order, retry_config) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(day_of_week, target_time, trigger_time, duration, activity, pgOrder, retryJson);
  return getRuleById(result.lastInsertRowid);
}

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

function deleteRule(id) {
  const d = getDb();
  d.prepare('UPDATE booking_logs SET rule_id = NULL WHERE rule_id = ?').run(id);
  return d.prepare('DELETE FROM booking_rules WHERE id = ?').run(id);
}

// --- Booking Logs ---

function getLogs(limit = 50) {
  return getDb().prepare(
    'SELECT * FROM booking_logs ORDER BY created_at DESC LIMIT ?'
  ).all(limit);
}

function createLog({ rule_id, target_date, target_time, booked_time, playground, status, booking_id, error_message }) {
  const stmt = getDb().prepare(
    `INSERT INTO booking_logs (rule_id, target_date, target_time, booked_time, playground, status, booking_id, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  return stmt.run(rule_id, target_date, target_time, booked_time, playground, status, booking_id, error_message);
}

function deleteLogs(ids) {
  if (!ids || ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  return getDb().prepare(`DELETE FROM booking_logs WHERE id IN (${placeholders})`).run(...ids);
}

function getUpcomingBookings() {
  const today = new Date().toISOString().split('T')[0];
  return getDb().prepare(
    "SELECT * FROM booking_logs WHERE target_date >= ? AND status = 'success' ORDER BY target_date, booked_time"
  ).all(today);
}

// --- Settings ---

function getSetting(key, defaultValue = null) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

// --- Credential Encryption ---

// Derive a stable encryption key from DB_PATH + a fixed salt.
// Not meant to resist a targeted attacker with full disk access,
// but prevents the password from sitting in plaintext in the SQLite file.
const ENCRYPTION_KEY = crypto.scryptSync(DB_PATH, 'sdlv-booker-salt', 32);

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as iv:tag:ciphertext (hex-encoded)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(data) {
  const [ivHex, tagHex, encHex] = data.split(':');
  if (!ivHex || !tagHex || !encHex) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(encHex, 'hex', 'utf8') + decipher.final('utf8');
}

// --- Credentials ---

function getCredentials() {
  const email = getSetting('doinsport_email');
  const encPassword = getSetting('doinsport_password');
  if (!email || !encPassword) return null;

  // Support both encrypted (contains ':') and legacy plaintext passwords
  let password;
  if (encPassword.includes(':')) {
    try {
      password = decrypt(encPassword);
    } catch {
      // Decryption failed — likely a legacy plaintext value, use as-is
      password = encPassword;
    }
  } else {
    password = encPassword;
  }

  return { email, password };
}

function setCredentials(email, password) {
  setSetting('doinsport_email', email);
  setSetting('doinsport_password', encrypt(password));
}

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

module.exports = {
  getDb,
  getAllRules,
  getEnabledRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  getLogs,
  createLog,
  deleteLogs,
  getUpcomingBookings,
  getSetting,
  setSetting,
  getCredentials,
  setCredentials,
  getActiveRetries,
  getDueRetries,
  getActiveRetryForRule,
  createRetryEntry,
  updateRetryEntry,
  cancelRetryEntry,
  getRetryById,
};
