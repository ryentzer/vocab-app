import type { APIRoute } from 'astro';
import { getDueWords, getDueWordsForList, updateStreakOnSessionEnd } from '../../lib/db.js';

/**
 * GET /api/session?card=N&reviewed=N&correct=N&quality=N[&listId=N]
 * Advance to next card or end session.
 */
export const GET: APIRoute = ({ request, locals }) => {
  const userId = locals.user!.id;
  const url = new URL(request.url);
  const card = parseInt(url.searchParams.get('card') ?? '0', 10);
  const reviewed = parseInt(url.searchParams.get('reviewed') ?? '0', 10);
  const correct = parseInt(url.searchParams.get('correct') ?? '0', 10);
  const listIdParam = url.searchParams.get('listId');
  const listId = listIdParam ? parseInt(listIdParam, 10) : null;

  const listParam = listId ? `&listId=${listId}` : '';

  const nextCard = card + 1;
  const dueWords = listId
    ? getDueWordsForList(userId, listId, 20)
    : getDueWords(userId, 20);
  const totalCards = dueWords.length;

  if (nextCard >= totalCards) {
    // Session complete — update streak and redirect to summary
    const updatedStats = updateStreakOnSessionEnd(userId, reviewed, correct);
    const redirectUrl = `/study?done=1&reviewed=${reviewed}&correct=${correct}&streak=${updatedStats.current_streak}${listParam}`;
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  }

  // Advance to next card
  return new Response(null, {
    status: 302,
    headers: { Location: `/study?card=${nextCard}&reviewed=${reviewed}&correct=${correct}${listParam}` },
  });
};
