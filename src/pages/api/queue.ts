import type { APIRoute } from 'astro';
import { upsertProgress, addWordsToQueue, getListById, getDb } from '../../lib/db.js';
import { todayISO } from '../../lib/srs.js';

/** POST /api/queue
 * { wordId: number }                         → add a single word
 * { count: number }                          → add N unlearned words (any level)
 * { count: number, level: string }           → add N unlearned words from a specific level
 * { listId: number }                         → add all words from a list to the queue
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const userId = locals.user!.id;
  let body: { wordId?: number; count?: number; level?: string; listId?: number };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const today = todayISO();

  if (typeof body.wordId === 'number') {
    upsertProgress(userId, body.wordId, today);
    return new Response(JSON.stringify({ ok: true, added: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (typeof body.listId === 'number') {
    // Verify the list belongs to the user
    const list = getListById(body.listId, userId);
    if (!list) {
      return new Response(JSON.stringify({ error: 'List not found' }), { status: 404 });
    }

    const db = getDb();
    const listWords = db
      .prepare('SELECT word_id FROM list_words WHERE list_id = ?')
      .all(body.listId) as { word_id: number }[];

    const insert = db.prepare(
      `INSERT OR IGNORE INTO progress (user_id, word_id, next_review) VALUES (?, ?, ?)`,
    );
    const insertMany = db.transaction(() => {
      for (const lw of listWords) {
        insert.run(userId, lw.word_id, today);
      }
    });
    insertMany();

    return new Response(JSON.stringify({ ok: true, added: listWords.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (typeof body.count === 'number' && body.count > 0) {
    let added: number;

    if (body.level) {
      // Add unlearned words from a specific level
      const db = getDb();
      const unlearned = db
        .prepare(
          `SELECT w.id FROM words w
           LEFT JOIN progress p ON p.word_id = w.id AND p.user_id = ?
           WHERE p.id IS NULL AND w.level = ?
           ORDER BY w.id
           LIMIT ?`,
        )
        .all(userId, body.level, body.count) as { id: number }[];

      const insert = db.prepare(
        `INSERT OR IGNORE INTO progress (user_id, word_id, next_review) VALUES (?, ?, ?)`,
      );
      const insertMany = db.transaction((rows: { id: number }[]) => {
        for (const row of rows) insert.run(userId, row.id, today);
      });
      insertMany(unlearned);
      added = unlearned.length;
    } else {
      added = addWordsToQueue(userId, body.count, today);
    }

    return new Response(JSON.stringify({ ok: true, added }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Provide wordId, listId, or count' }), { status: 400 });
};
