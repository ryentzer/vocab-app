import type { APIRoute } from 'astro';
import { upsertProgress, addWordsToQueue, getDb } from '../../lib/db.js';
import { todayISO } from '../../lib/srs.js';

/** POST /api/queue
 * { wordId: number }                    → add a single word
 * { count: number }                     → add N unlearned words (any level)
 * { count: number, level: string }      → add N unlearned words from a specific level
 */
export const POST: APIRoute = async ({ request }) => {
  let body: { wordId?: number; count?: number; level?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const today = todayISO();

  if (typeof body.wordId === 'number') {
    upsertProgress(body.wordId, today);
    return new Response(JSON.stringify({ ok: true, added: 1 }), {
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
           LEFT JOIN progress p ON p.word_id = w.id
           WHERE p.id IS NULL AND w.level = ?
           ORDER BY w.id
           LIMIT ?`,
        )
        .all(body.level, body.count) as { id: number }[];

      const insert = db.prepare(
        `INSERT OR IGNORE INTO progress (word_id, next_review) VALUES (?, ?)`,
      );
      const insertMany = db.transaction((rows: { id: number }[]) => {
        for (const row of rows) insert.run(row.id, today);
      });
      insertMany(unlearned);
      added = unlearned.length;
    } else {
      added = addWordsToQueue(body.count, today);
    }

    return new Response(JSON.stringify({ ok: true, added }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Provide wordId or count' }), { status: 400 });
};
