import Database from 'better-sqlite3';
import { join } from 'path';
import { todayISO, yesterdayISO } from './srs.js';

const DB_PATH = join(process.cwd(), 'vocab.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  // Words table is always safe — stays across migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id              INTEGER PRIMARY KEY,
      word            TEXT NOT NULL UNIQUE,
      definition      TEXT NOT NULL,
      part_of_speech  TEXT,
      example         TEXT,
      level           TEXT
    );
  `);

  // Migration guard: version 0 → 1 moves from single-user to multi-user schema
  const version = db.pragma('user_version', { simple: true }) as number;
  if (version < 1) {
    db.exec(`
      DROP TABLE IF EXISTS progress;
      DROP TABLE IF EXISTS user_stats;

      CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY,
        username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id         INTEGER PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lists (
        id          INTEGER PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        description TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, name)
      );

      CREATE TABLE IF NOT EXISTS list_words (
        list_id  INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
        word_id  INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (list_id, word_id)
      );

      CREATE TABLE IF NOT EXISTS progress (
        id            INTEGER PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        word_id       INTEGER NOT NULL REFERENCES words(id),
        mastery       INTEGER DEFAULT 0,
        ease_factor   REAL    DEFAULT 2.5,
        interval_days INTEGER DEFAULT 1,
        next_review   TEXT    DEFAULT (date('now')),
        times_seen    INTEGER DEFAULT 0,
        times_correct INTEGER DEFAULT 0,
        last_reviewed TEXT,
        UNIQUE(user_id, word_id)
      );

      CREATE TABLE IF NOT EXISTS user_stats (
        id              INTEGER PRIMARY KEY,
        user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        current_streak  INTEGER DEFAULT 0,
        longest_streak  INTEGER DEFAULT 0,
        last_study_date TEXT,
        total_reviewed  INTEGER DEFAULT 0,
        total_correct   INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_progress_user_review ON progress(user_id, next_review);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

      PRAGMA user_version = 1;
    `);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Word {
  id: number;
  word: string;
  definition: string;
  part_of_speech: string | null;
  example: string | null;
  level: string | null;
}

export interface Progress {
  id: number;
  user_id: number;
  word_id: number;
  mastery: number;
  ease_factor: number;
  interval_days: number;
  next_review: string;
  times_seen: number;
  times_correct: number;
  last_reviewed: string | null;
}

export interface WordWithProgress extends Word {
  progress_id: number | null;
  mastery: number;
  ease_factor: number;
  interval_days: number;
  next_review: string | null;
  times_seen: number;
  times_correct: number;
  last_reviewed: string | null;
}

export interface MasteryBreakdown {
  new_count: number;
  learning_count: number;
  mastered_count: number;
}

export interface UserStats {
  id: number;
  user_id: number;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  total_reviewed: number;
  total_correct: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  token: string;
  created_at: string;
  expires_at: string;
}

export interface WordList {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface ListWord {
  list_id: number;
  word_id: number;
  added_at: string;
}

// ── Words ─────────────────────────────────────────────────────────────────────

export function getAllWords(): Word[] {
  return getDb().prepare('SELECT * FROM words ORDER BY word').all() as Word[];
}

export function getWordById(id: number): Word | null {
  return (getDb().prepare('SELECT * FROM words WHERE id = ?').get(id) as Word) ?? null;
}

export function getWordByWord(word: string): Word | null {
  return (getDb().prepare('SELECT * FROM words WHERE word = ?').get(word) as Word) ?? null;
}

export function countWords(): number {
  const row = getDb().prepare('SELECT COUNT(*) as cnt FROM words').get() as { cnt: number };
  return row.cnt;
}

// ── Progress ──────────────────────────────────────────────────────────────────

export function getDueWords(userId: number, limit = 20): WordWithProgress[] {
  const today = todayISO();
  return getDb()
    .prepare(
      `SELECT w.*, p.id as progress_id, p.mastery, p.ease_factor, p.interval_days,
              p.next_review, p.times_seen, p.times_correct, p.last_reviewed
       FROM words w
       JOIN progress p ON p.word_id = w.id AND p.user_id = ?
       WHERE p.next_review <= ?
       ORDER BY p.next_review ASC
       LIMIT ?`,
    )
    .all(userId, today, limit) as WordWithProgress[];
}

export function getDueWordsForList(userId: number, listId: number, limit = 20): WordWithProgress[] {
  const today = todayISO();
  return getDb()
    .prepare(
      `SELECT w.*, p.id as progress_id, p.mastery, p.ease_factor, p.interval_days,
              p.next_review, p.times_seen, p.times_correct, p.last_reviewed
       FROM words w
       JOIN list_words lw ON lw.word_id = w.id AND lw.list_id = ?
       JOIN progress p ON p.word_id = w.id AND p.user_id = ?
       WHERE p.next_review <= ?
       ORDER BY p.next_review ASC
       LIMIT ?`,
    )
    .all(listId, userId, today, limit) as WordWithProgress[];
}

export function countDueWords(userId: number): number {
  const today = todayISO();
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as cnt
       FROM progress
       WHERE user_id = ? AND next_review <= ?`,
    )
    .get(userId, today) as { cnt: number };
  return row.cnt;
}

export function getProgressById(progressId: number, userId: number): Progress | null {
  return (
    (getDb()
      .prepare('SELECT * FROM progress WHERE id = ? AND user_id = ?')
      .get(progressId, userId) as Progress) ?? null
  );
}

export function getProgressByWordId(userId: number, wordId: number): Progress | null {
  return (
    (getDb()
      .prepare('SELECT * FROM progress WHERE user_id = ? AND word_id = ?')
      .get(userId, wordId) as Progress) ?? null
  );
}

export function upsertProgress(userId: number, wordId: number, today: string): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO progress (user_id, word_id, next_review)
       VALUES (?, ?, ?)`,
    )
    .run(userId, wordId, today);
}

export function updateProgress(
  progressId: number,
  mastery: number,
  ease_factor: number,
  interval_days: number,
  next_review: string,
  correct: boolean,
): void {
  getDb()
    .prepare(
      `UPDATE progress
       SET mastery = ?, ease_factor = ?, interval_days = ?, next_review = ?,
           times_seen = times_seen + 1,
           times_correct = times_correct + ?,
           last_reviewed = date('now')
       WHERE id = ?`,
    )
    .run(mastery, ease_factor, interval_days, next_review, correct ? 1 : 0, progressId);
}

// ── Mastery breakdown ─────────────────────────────────────────────────────────

export function getMasteryBreakdown(userId: number): MasteryBreakdown {
  const db = getDb();
  const totalWords = countWords();
  const seen = db
    .prepare(
      `SELECT
         SUM(CASE WHEN mastery >= 5 THEN 1 ELSE 0 END) as mastered,
         SUM(CASE WHEN mastery BETWEEN 1 AND 4 THEN 1 ELSE 0 END) as learning
       FROM progress
       WHERE user_id = ?`,
    )
    .get(userId) as { mastered: number; learning: number };

  const mastered = seen.mastered ?? 0;
  const learning = seen.learning ?? 0;
  const seenZero = (
    db.prepare('SELECT COUNT(*) as cnt FROM progress WHERE user_id = ? AND mastery = 0').get(userId) as { cnt: number }
  ).cnt;
  const seenTotal = mastered + learning + seenZero;
  const newCount = totalWords - seenTotal;

  return {
    new_count: Math.max(0, newCount),
    learning_count: learning,
    mastered_count: mastered,
  };
}

// ── User stats / streak ───────────────────────────────────────────────────────

export function initUserStats(userId: number): void {
  getDb()
    .prepare('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)')
    .run(userId);
}

export function getUserStats(userId: number): UserStats {
  return getDb()
    .prepare('SELECT * FROM user_stats WHERE user_id = ?')
    .get(userId) as UserStats;
}

export function updateStreakOnSessionEnd(userId: number, reviewed: number, correct: number): UserStats {
  const db = getDb();
  const stats = getUserStats(userId);
  const today = todayISO();
  const yesterday = yesterdayISO();

  let newStreak = stats.current_streak;

  if (stats.last_study_date === today) {
    // Already studied today — no change to streak
  } else if (stats.last_study_date === yesterday) {
    newStreak = stats.current_streak + 1;
  } else {
    newStreak = 1;
  }

  const newLongest = Math.max(stats.longest_streak, newStreak);

  db.prepare(
    `UPDATE user_stats
     SET current_streak = ?, longest_streak = ?, last_study_date = ?,
         total_reviewed = total_reviewed + ?,
         total_correct  = total_correct  + ?
     WHERE user_id = ?`,
  ).run(newStreak, newLongest, today, reviewed, correct, userId);

  return getUserStats(userId);
}

// ── Word of the day ───────────────────────────────────────────────────────────

export function getWordOfTheDay(): Word {
  const db = getDb();
  const total = countWords();
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const idx = dayOfYear % total;
  return db.prepare('SELECT * FROM words ORDER BY id LIMIT 1 OFFSET ?').get(idx) as Word;
}

export function getYesterdaysWord(): Word {
  const db = getDb();
  const total = countWords();
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const idx = dayOfYear % total;
  return db.prepare('SELECT * FROM words ORDER BY id LIMIT 1 OFFSET ?').get(idx) as Word;
}

// ── Queue management ──────────────────────────────────────────────────────────

export function addWordsToQueue(userId: number, limit: number, today: string): number {
  const db = getDb();
  const unlearned = db
    .prepare(
      `SELECT w.id FROM words w
       LEFT JOIN progress p ON p.word_id = w.id AND p.user_id = ?
       WHERE p.id IS NULL
       ORDER BY w.id
       LIMIT ?`,
    )
    .all(userId, limit) as { id: number }[];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO progress (user_id, word_id, next_review) VALUES (?, ?, ?)`,
  );
  const insertMany = db.transaction((rows: { id: number }[]) => {
    for (const row of rows) {
      insert.run(userId, row.id, today);
    }
  });
  insertMany(unlearned);
  return unlearned.length;
}

export function countUnlearnedWords(userId: number): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as cnt FROM words w
       LEFT JOIN progress p ON p.word_id = w.id AND p.user_id = ?
       WHERE p.id IS NULL`,
    )
    .get(userId) as { cnt: number };
  return row.cnt;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function createUser(username: string, email: string, password_hash: string): User {
  const result = getDb()
    .prepare(`INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`)
    .run(username, email, password_hash);
  return getUserById(result.lastInsertRowid as number)!;
}

export function getUserByEmail(email: string): User | null {
  return (getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as User) ?? null;
}

export function getUserByUsername(username: string): User | null {
  return (getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as User) ?? null;
}

export function getUserById(id: number): User | null {
  return (getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User) ?? null;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function createSession(userId: number, token: string): Session {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const expiresAtStr = expiresAt.toISOString().replace('T', ' ').split('.')[0]!;

  const result = getDb()
    .prepare(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`)
    .run(userId, token, expiresAtStr);

  return getDb()
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(result.lastInsertRowid as number) as Session;
}

export function getSessionByToken(token: string): { user: User } | null {
  const row = getDb()
    .prepare(
      `SELECT u.id, u.username, u.email, u.password_hash, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`,
    )
    .get(token) as User | undefined;

  return row ? { user: row } : null;
}

export function deleteSession(token: string): void {
  getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function cleanExpiredSessions(): void {
  getDb().prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();
}

// ── Word Lists ────────────────────────────────────────────────────────────────

export function getLists(userId: number): WordList[] {
  return getDb()
    .prepare('SELECT * FROM lists WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as WordList[];
}

export function getListById(id: number, userId: number): WordList | null {
  return (
    (getDb()
      .prepare('SELECT * FROM lists WHERE id = ? AND user_id = ?')
      .get(id, userId) as WordList) ?? null
  );
}

export function createList(userId: number, name: string, description?: string): WordList {
  const result = getDb()
    .prepare(`INSERT INTO lists (user_id, name, description) VALUES (?, ?, ?)`)
    .run(userId, name, description ?? null);
  return getDb()
    .prepare('SELECT * FROM lists WHERE id = ?')
    .get(result.lastInsertRowid as number) as WordList;
}

export function updateList(id: number, userId: number, name: string, description?: string): void {
  getDb()
    .prepare(`UPDATE lists SET name = ?, description = ? WHERE id = ? AND user_id = ?`)
    .run(name, description ?? null, id, userId);
}

export function deleteList(id: number, userId: number): void {
  getDb()
    .prepare('DELETE FROM lists WHERE id = ? AND user_id = ?')
    .run(id, userId);
}

export function getListWords(listId: number, userId: number): WordWithProgress[] {
  return getDb()
    .prepare(
      `SELECT w.*,
              p.id as progress_id,
              COALESCE(p.mastery, 0) as mastery,
              COALESCE(p.ease_factor, 2.5) as ease_factor,
              COALESCE(p.interval_days, 1) as interval_days,
              p.next_review,
              COALESCE(p.times_seen, 0) as times_seen,
              COALESCE(p.times_correct, 0) as times_correct,
              p.last_reviewed
       FROM words w
       JOIN list_words lw ON lw.word_id = w.id AND lw.list_id = ?
       LEFT JOIN progress p ON p.word_id = w.id AND p.user_id = ?
       ORDER BY w.word`,
    )
    .all(listId, userId) as WordWithProgress[];
}

export function addWordToList(listId: number, wordId: number): void {
  getDb()
    .prepare(`INSERT OR IGNORE INTO list_words (list_id, word_id) VALUES (?, ?)`)
    .run(listId, wordId);
}

export function removeWordFromList(listId: number, wordId: number): void {
  getDb()
    .prepare('DELETE FROM list_words WHERE list_id = ? AND word_id = ?')
    .run(listId, wordId);
}

export function getListWordCount(listId: number): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) as cnt FROM list_words WHERE list_id = ?')
    .get(listId) as { cnt: number };
  return row.cnt;
}
