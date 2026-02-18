import type { APIRoute } from 'astro';
import { getDb, getProgressByWordId, updateProgress } from '../../lib/db.js';
import { computeSRS } from '../../lib/srs.js';

export const POST: APIRoute = async ({ request }) => {
  let body: { progressId: number; quality: 0 | 2 | 3 | 5 };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { progressId, quality } = body;

  if (typeof progressId !== 'number' || ![0, 2, 3, 5].includes(quality)) {
    return new Response(JSON.stringify({ error: 'Invalid parameters' }), { status: 400 });
  }

  const db = getDb();
  const progress = db
    .prepare('SELECT * FROM progress WHERE id = ?')
    .get(progressId) as {
    id: number;
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

  // Store session progress in a temporary cookie-based counter
  // We'll handle session totals via URL params on the session end route
  // Return next card URL
  const url = new URL(request.url);
  const currentCard = parseInt(url.searchParams.get('card') ?? '0', 10);
  const reviewed = parseInt(url.searchParams.get('reviewed') ?? '0', 10) + 1;
  const correctCount = parseInt(url.searchParams.get('correct') ?? '0', 10) + (correct ? 1 : 0);

  // We embed session state in the response so the client can build the next URL
  return new Response(
    JSON.stringify({
      ok: true,
      nextUrl: `/api/session?card=${currentCard}&reviewed=${reviewed}&correct=${correctCount}&quality=${quality}`,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
