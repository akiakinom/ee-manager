const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      usos_id     TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      role        TEXT CHECK(role IN ('admin', 'editor')) DEFAULT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- type = 'semester_start'
    CREATE TABLE IF NOT EXISTS calendar_semesters (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      semester_id  TEXT NOT NULL,          -- e.g. "2025L", "2024Z"
      start_date   TEXT NOT NULL,          -- ISO date string e.g. "2025-02-17"
      is_published INTEGER DEFAULT 0,
      created_by   TEXT REFERENCES users(usos_id),
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- type = 'substitution'
    -- on original_date, classes are held as if it's day_of_week (1=Mon..5=Fri)
    CREATE TABLE IF NOT EXISTS calendar_substitutions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      original_date TEXT NOT NULL,         -- ISO date string e.g. "2025-01-06"
      day_of_week   INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 5),
      is_published  INTEGER DEFAULT 0,
      created_by    TEXT REFERENCES users(usos_id),
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- breaks: winter, easter, summer
    CREATE TABLE IF NOT EXISTS calendar_breaks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      type         TEXT NOT NULL CHECK(type IN ('winter', 'easter', 'summer')),
      date_from    TEXT NOT NULL,
      date_to      TEXT NOT NULL,
      is_published INTEGER DEFAULT 0,
      created_by   TEXT REFERENCES users(usos_id),
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- exam seasons
    CREATE TABLE IF NOT EXISTS calendar_exams (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      date_from    TEXT NOT NULL,
      date_to      TEXT NOT NULL,
      is_published INTEGER DEFAULT 0,
      created_by   TEXT REFERENCES users(usos_id),
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- dean's hours: no classes during a time window on a specific date
    CREATE TABLE IF NOT EXISTS calendar_deans_hours (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      date         TEXT NOT NULL,
      time_from    TEXT NOT NULL,   -- e.g. "12:00"
      time_to      TEXT NOT NULL,   -- e.g. "14:00"
      is_published INTEGER DEFAULT 0,
      created_by   TEXT REFERENCES users(usos_id),
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- QR code short links
    CREATE TABLE IF NOT EXISTS qr_links (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      slug         TEXT UNIQUE NOT NULL,   -- e.g. "elkonalia"
      target_url   TEXT NOT NULL,          -- where it redirects
      label        TEXT,                   -- optional display name
      color        TEXT DEFAULT '#000000', -- QR foreground color
      scan_count   INTEGER DEFAULT 0,
      created_by   TEXT REFERENCES users(usos_id),
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS student_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      location     TEXT,
      event_date   TEXT NOT NULL,          -- ISO datetime string
      description  TEXT,
      image        TEXT,                   -- filename stored in /public/uploads/
      is_published INTEGER DEFAULT 0,
      created_by   TEXT REFERENCES users(usos_id),
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

module.exports = { getDb };