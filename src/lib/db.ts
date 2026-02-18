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
  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id              INTEGER PRIMARY KEY,
      word            TEXT NOT NULL UNIQUE,
      definition      TEXT NOT NULL,
      part_of_speech  TEXT,
      example         TEXT,
      level           TEXT
    );

    CREATE TABLE IF NOT EXISTS progress (
      id              INTEGER PRIMARY KEY,
      word_id         INTEGER REFERENCES words(id),
      mastery         INTEGER DEFAULT 0,
      ease_factor     REAL    DEFAULT 2.5,
      interval_days   INTEGER DEFAULT 1,
      next_review     TEXT    DEFAULT (date('now')),
      times_seen      INTEGER DEFAULT 0,
      times_correct   INTEGER DEFAULT 0,
      last_reviewed   TEXT
    );

    CREATE TABLE IF NOT EXISTS user_stats (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      current_streak  INTEGER DEFAULT 0,
      longest_streak  INTEGER DEFAULT 0,
      last_study_date TEXT,
      total_reviewed  INTEGER DEFAULT 0,
      total_correct   INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO user_stats (id) VALUES (1);
  `);
}

// ── Words ────────────────────────────────────────────────────────────────────

export interface Word {
  id: number;
  word: string;
  definition: string;
  part_of_speech: string | null;
  example: string | null;
  level: string | null;
}

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

// ── Progress ─────────────────────────────────────────────────────────────────

export interface Progress {
  id: number;
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

export function getDueWords(limit = 20): WordWithProgress[] {
  const today = todayISO();
  return getDb()
    .prepare(
      `SELECT w.*, p.id as progress_id, p.mastery, p.ease_factor, p.interval_days,
              p.next_review, p.times_seen, p.times_correct, p.last_reviewed
       FROM words w
       JOIN progress p ON p.word_id = w.id
       WHERE p.next_review <= ?
       ORDER BY p.next_review ASC
       LIMIT ?`,
    )
    .all(today, limit) as WordWithProgress[];
}

export function countDueWords(): number {
  const today = todayISO();
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as cnt
       FROM progress
       WHERE next_review <= ?`,
    )
    .get(today) as { cnt: number };
  return row.cnt;
}

export function getProgressByWordId(wordId: number): Progress | null {
  return (
    (getDb()
      .prepare('SELECT * FROM progress WHERE word_id = ?')
      .get(wordId) as Progress) ?? null
  );
}

export function upsertProgress(wordId: number, today: string): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO progress (word_id, next_review)
       VALUES (?, ?)`,
    )
    .run(wordId, today);
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

// ── Mastery breakdown ────────────────────────────────────────────────────────

export interface MasteryBreakdown {
  new_count: number;        // never seen (no progress row)
  learning_count: number;   // mastery 1-4
  mastered_count: number;   // mastery 5
}

export function getMasteryBreakdown(): MasteryBreakdown {
  const db = getDb();
  const totalWords = countWords();
  const seen = db
    .prepare(
      `SELECT
         SUM(CASE WHEN mastery >= 5 THEN 1 ELSE 0 END) as mastered,
         SUM(CASE WHEN mastery BETWEEN 1 AND 4 THEN 1 ELSE 0 END) as learning
       FROM progress`,
    )
    .get() as { mastered: number; learning: number };

  const mastered = seen.mastered ?? 0;
  const learning = seen.learning ?? 0;
  const seenTotal = mastered + learning + (
    (getDb().prepare('SELECT COUNT(*) as cnt FROM progress WHERE mastery = 0').get() as { cnt: number }).cnt
  );
  const newCount = totalWords - seenTotal;

  return {
    new_count: Math.max(0, newCount),
    learning_count: learning,
    mastered_count: mastered,
  };
}

// ── User stats / streak ───────────────────────────────────────────────────────

export interface UserStats {
  id: number;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  total_reviewed: number;
  total_correct: number;
}

export function getUserStats(): UserStats {
  return getDb().prepare('SELECT * FROM user_stats WHERE id = 1').get() as UserStats;
}

export function updateStreakOnSessionEnd(reviewed: number, correct: number): UserStats {
  const db = getDb();
  const stats = getUserStats();
  const today = todayISO();
  const yesterday = yesterdayISO();

  let newStreak = stats.current_streak;

  if (stats.last_study_date === today) {
    // Already studied today — no change to streak
  } else if (stats.last_study_date === yesterday) {
    // Consecutive day
    newStreak = stats.current_streak + 1;
  } else {
    // Streak broken or first time
    newStreak = 1;
  }

  const newLongest = Math.max(stats.longest_streak, newStreak);

  db.prepare(
    `UPDATE user_stats
     SET current_streak = ?, longest_streak = ?, last_study_date = ?,
         total_reviewed = total_reviewed + ?,
         total_correct  = total_correct  + ?
     WHERE id = 1`,
  ).run(newStreak, newLongest, today, reviewed, correct);

  return getUserStats();
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
  const row = db
    .prepare('SELECT * FROM words ORDER BY id LIMIT 1 OFFSET ?')
    .get(idx) as Word;
  return row;
}

// ── Queue management ─────────────────────────────────────────────────────────

export function addWordsToQueue(limit: number, today: string): number {
  const db = getDb();
  // Pick words that have no progress row yet
  const unlearned = db
    .prepare(
      `SELECT w.id FROM words w
       LEFT JOIN progress p ON p.word_id = w.id
       WHERE p.id IS NULL
       ORDER BY w.id
       LIMIT ?`,
    )
    .all(limit) as { id: number }[];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO progress (word_id, next_review) VALUES (?, ?)`,
  );
  const insertMany = db.transaction((rows: { id: number }[]) => {
    for (const row of rows) {
      insert.run(row.id, today);
    }
  });
  insertMany(unlearned);
  return unlearned.length;
}

export function countUnlearnedWords(): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as cnt FROM words w
       LEFT JOIN progress p ON p.word_id = w.id
       WHERE p.id IS NULL`,
    )
    .get() as { cnt: number };
  return row.cnt;
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
  const row = db
    .prepare('SELECT * FROM words ORDER BY id LIMIT 1 OFFSET ?')
    .get(idx) as Word;
  return row;
}
