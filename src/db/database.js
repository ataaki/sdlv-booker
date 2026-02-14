const Database = require('better-sqlite3');
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

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS booking_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL,          -- 0=Sunday, 1=Monday, ..., 6=Saturday
      target_time TEXT NOT NULL,              -- HH:MM format (local time)
      duration INTEGER NOT NULL DEFAULT 60,  -- minutes: 60, 90, 120
      activity TEXT NOT NULL DEFAULT 'football_5v5',
      playground_order TEXT,                  -- JSON array: ["Foot 3","Foot 7","Foot 1"]
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS booking_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER,
      target_date TEXT NOT NULL,              -- YYYY-MM-DD
      target_time TEXT NOT NULL,              -- HH:MM
      booked_time TEXT,                       -- actual booked time HH:MM
      playground TEXT,
      status TEXT NOT NULL,                   -- 'success', 'failed', 'no_slots', 'pending', 'skipped'
      booking_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (rule_id) REFERENCES booking_rules(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add playground_order column if missing
  const cols = db.pragma('table_info(booking_rules)');
  if (!cols.some(c => c.name === 'playground_order')) {
    db.exec('ALTER TABLE booking_rules ADD COLUMN playground_order TEXT');
  }

  // Migration: add trigger_time column if missing
  if (!cols.some(c => c.name === 'trigger_time')) {
    db.exec("ALTER TABLE booking_rules ADD COLUMN trigger_time TEXT NOT NULL DEFAULT '00:00'");
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

function createRule({ day_of_week, target_time, trigger_time = '00:00', duration = 60, activity = 'football_5v5', playground_order = null }) {
  const pgOrder = playground_order ? JSON.stringify(playground_order) : null;
  const stmt = getDb().prepare(
    'INSERT INTO booking_rules (day_of_week, target_time, trigger_time, duration, activity, playground_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(day_of_week, target_time, trigger_time, duration, activity, pgOrder);
  return getRuleById(result.lastInsertRowid);
}

function updateRule(id, { day_of_week, target_time, trigger_time, duration, enabled, playground_order }) {
  const fields = [];
  const values = [];

  if (day_of_week !== undefined) { fields.push('day_of_week = ?'); values.push(day_of_week); }
  if (target_time !== undefined) { fields.push('target_time = ?'); values.push(target_time); }
  if (trigger_time !== undefined) { fields.push('trigger_time = ?'); values.push(trigger_time); }
  if (duration !== undefined) { fields.push('duration = ?'); values.push(duration); }
  if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled ? 1 : 0); }
  if (playground_order !== undefined) { fields.push('playground_order = ?'); values.push(playground_order ? JSON.stringify(playground_order) : null); }

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

// --- Credentials ---

function getCredentials() {
  const email = getSetting('doinsport_email');
  const password = getSetting('doinsport_password');
  if (!email || !password) return null;
  return { email, password };
}

function setCredentials(email, password) {
  setSetting('doinsport_email', email);
  setSetting('doinsport_password', password);
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
};
