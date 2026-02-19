import type { APIRoute } from 'astro';
import { getListById, addWordToList, removeWordFromList, getWordById } from '../../../../lib/db.js';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const userId = locals.user!.id;
  const listId = parseInt(params.id ?? '', 10);

  if (isNaN(listId)) {
    return new Response(JSON.stringify({ error: 'Invalid list ID' }), { status: 400 });
  }

  const list = getListById(listId, userId);
  if (!list) {
    return new Response(JSON.stringify({ error: 'List not found' }), { status: 404 });
  }

  let body: { wordId?: number };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { wordId } = body;
  if (typeof wordId !== 'number') {
    return new Response(JSON.stringify({ error: 'wordId is required' }), { status: 400 });
  }

  const word = getWordById(wordId);
  if (!word) {
    return new Response(JSON.stringify({ error: 'Word not found' }), { status: 404 });
  }

  addWordToList(listId, wordId);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const userId = locals.user!.id;
  const listId = parseInt(params.id ?? '', 10);

  if (isNaN(listId)) {
    return new Response(JSON.stringify({ error: 'Invalid list ID' }), { status: 400 });
  }

  const list = getListById(listId, userId);
  if (!list) {
    return new Response(JSON.stringify({ error: 'List not found' }), { status: 404 });
  }

  let body: { wordId?: number };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { wordId } = body;
  if (typeof wordId !== 'number') {
    return new Response(JSON.stringify({ error: 'wordId is required' }), { status: 400 });
  }

  removeWordFromList(listId, wordId);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
