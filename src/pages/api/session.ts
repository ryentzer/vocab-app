import type { APIRoute } from 'astro';
import { getDueWords, updateStreakOnSessionEnd } from '../../lib/db.js';

/**
 * GET /api/session?card=N&reviewed=N&correct=N&quality=N
 * Advance to next card or end session.
 */
export const GET: APIRoute = ({ request }) => {
  const url = new URL(request.url);
  const card = parseInt(url.searchParams.get('card') ?? '0', 10);
  const reviewed = parseInt(url.searchParams.get('reviewed') ?? '0', 10);
  const correct = parseInt(url.searchParams.get('correct') ?? '0', 10);

  const nextCard = card + 1;
  const dueWords = getDueWords(20);
  const totalCards = dueWords.length;

  if (nextCard >= totalCards) {
    // Session complete — update streak and redirect to summary
    const updatedStats = updateStreakOnSessionEnd(reviewed, correct);
    const redirectUrl = `/study?done=1&reviewed=${reviewed}&correct=${correct}&streak=${updatedStats.current_streak}`;
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  }

  // Advance to next card
  return new Response(null, {
    status: 302,
    headers: { Location: `/study?card=${nextCard}&reviewed=${reviewed}&correct=${correct}` },
  });
};
