const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database.db');
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  initSchema();
  return db;
}

function saveDb() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function initSchema() {
  // Users table (NEW - for authentication)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      email           TEXT UNIQUE NOT NULL,
      password_hash   TEXT NOT NULL,
      name            TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lessons (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL,
      title           TEXT,
      level           TEXT DEFAULT 'A1',
      unit            TEXT,
      topic           TEXT,
      objectives_json TEXT DEFAULT '[]',
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS words (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL,
      word           TEXT NOT NULL,
      article        TEXT,
      plural         TEXT,
      type           TEXT,
      translation_fr TEXT,
      translation_ar TEXT,
      example_de     TEXT,
      example_fr     TEXT,
      level          TEXT DEFAULT 'A1',
      topic          TEXT,
      lesson_id      INTEGER,
      created_at     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS grammar_rules (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id       INTEGER,
      rule_title      TEXT,
      explanation_fr  TEXT,
      explanation_ar  TEXT,
      examples_json   TEXT DEFAULT '[]',
      table_json      TEXT DEFAULT '[]',
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS dialogues (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id  INTEGER,
      title      TEXT,
      lines_json TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS expressions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id      INTEGER,
      expression     TEXT,
      translation_fr TEXT,
      translation_ar TEXT,
      context        TEXT,
      created_at     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS exercises (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id       INTEGER,
      type            TEXT,
      instruction_de  TEXT,
      instruction_fr  TEXT,
      questions_json  TEXT DEFAULT '[]',
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS review_schedule (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id      INTEGER,
      difficulty   TEXT DEFAULT 'new',
      next_review  TEXT DEFAULT (datetime('now')),
      review_count INTEGER DEFAULT 0,
      last_score   INTEGER,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      quiz_type   TEXT,
      word_id     INTEGER,
      user_answer TEXT,
      correct     INTEGER,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS pronunciation_sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      word_id     INTEGER,
      spoken_text TEXT,
      score       INTEGER,
      feedback_fr TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS summary_cache (
      id               INTEGER PRIMARY KEY CHECK (id = 1),
      summary_json     TEXT NOT NULL,
      lesson_signature TEXT NOT NULL,
      generated_by     TEXT DEFAULT 'ai',
      updated_at       TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_page_cache (
      page_key     TEXT PRIMARY KEY,
      content_json TEXT NOT NULL,
      updated_at   TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS mistakes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      lesson_id     INTEGER,
      mistake_type  TEXT NOT NULL,
      expected      TEXT NOT NULL,
      user_answer   TEXT NOT NULL,
      related_rule  TEXT,
      count         INTEGER DEFAULT 1,
      last_seen     TEXT DEFAULT (datetime('now')),
      created_at    TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS lesson_attempts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL,
      lesson_id      INTEGER,
      activity_type  TEXT NOT NULL,
      score          INTEGER,
      metadata_json  TEXT DEFAULT '{}',
      created_at     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS generated_content (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      lesson_id     INTEGER,
      type          TEXT NOT NULL,
      title         TEXT,
      content_json  TEXT NOT NULL,
      from_pdf      INTEGER DEFAULT 0,
      based_on_pdf  INTEGER DEFAULT 1,
      generated_by  TEXT DEFAULT 'local',
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
    )
  `);
  migrateSchema();
  saveDb();
}

function tableColumns(tableName) {
  return query(`PRAGMA table_info(${tableName})`).map(column => column.name);
}

function ensureColumn(tableName, columnName, definition) {
  const columns = tableColumns(tableName);
  if (!columns.includes(columnName)) {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function migrateSchema() {
  ensureColumn('lessons', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
  ensureColumn('words', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
  ensureColumn('quiz_sessions', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
  ensureColumn('pronunciation_sessions', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
  ensureColumn('generated_content', 'title', 'TEXT');
  ensureColumn('generated_content', 'generated_by', "TEXT DEFAULT 'local'");
  ensureColumn('generated_content', 'updated_at', "TEXT DEFAULT (datetime('now'))");
}

function normalizeParams(params = []) {
  return params.map(value => value === undefined ? null : value);
}

function query(sql, params = []) {
  if (!db) throw new Error('Database is not initialized. Call getDb() before query().');
  const stmt = db.prepare(sql);
  stmt.bind(normalizeParams(params));
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getInsertedTable(sql) {
  const match = sql.match(/^\s*INSERT\s+INTO\s+["`[]?([A-Za-z_][A-Za-z0-9_]*)/i);
  return match?.[1] || null;
}

function run(sql, params = []) {
  const insertedTable = getInsertedTable(sql);
  db.run(sql, normalizeParams(params));
  const lastInsertRowid = insertedTable
    ? query('SELECT last_insert_rowid() as id')[0]?.id
    : undefined;
  saveDb();
  return { lastInsertRowid };
}

module.exports = { getDb, query, run, saveDb };
