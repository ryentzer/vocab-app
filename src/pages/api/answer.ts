import type { APIRoute } from 'astro';
import { getDb, updateProgress } from '../../lib/db.js';
import { computeSRS } from '../../lib/srs.js';

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = locals.user!.id;
  let body: { progressId: number; quality: 0 | 2 | 3 | 5; listId?: number };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { progressId, quality, listId } = body;

  if (typeof progressId !== 'number' || ![0, 2, 3, 5].includes(quality)) {
    return new Response(JSON.stringify({ error: 'Invalid parameters' }), { status: 400 });
  }

  const db = getDb();
  // Ownership check: ensure this progress row belongs to the logged-in user
  const progress = db
    .prepare('SELECT * FROM progress WHERE id = ? AND user_id = ?')
    .get(progressId, userId) as {
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
  } | null;

  if (!progress) {
    return new Response(JSON.stringify({ error: 'Progress record not found' }), { status: 404 });
  }

  const srs = computeSRS(quality, progress.interval_days, progress.ease_factor, progress.mastery);
  const correct = quality >= 3;

  updateProgress(
    progressId,
    srs.mastery,
    srs.ease_factor,
    srs.interval_days,
    srs.next_review,
    correct,
  );

  const url = new URL(request.url);
  const currentCard = parseInt(url.searchParams.get('card') ?? '0', 10);
  const reviewed = parseInt(url.searchParams.get('reviewed') ?? '0', 10) + 1;
  const correctCount = parseInt(url.searchParams.get('correct') ?? '0', 10) + (correct ? 1 : 0);

  const listParam = listId ? `&listId=${listId}` : '';

  return new Response(
    JSON.stringify({
      ok: true,
      nextUrl: `/api/session?card=${currentCard}&reviewed=${reviewed}&correct=${correctCount}&quality=${quality}${listParam}`,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
