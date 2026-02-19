import type { APIRoute } from 'astro';
import { getListById, updateList, deleteList } from '../../../../lib/db.js';

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const userId = locals.user!.id;
  const listId = parseInt(params.id ?? '', 10);

  if (isNaN(listId)) {
    return new Response(JSON.stringify({ error: 'Invalid list ID' }), { status: 400 });
  }

  const list = getListById(listId, userId);
  if (!list) {
    return new Response(JSON.stringify({ error: 'List not found' }), { status: 404 });
  }

  let body: { name?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const name = body.name?.trim() ?? list.name;
  if (!name || name.length === 0) {
    return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400 });
  }

  try {
    updateList(listId, userId, name, body.description?.trim());
    const updated = getListById(listId, userId);
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE')) {
      return new Response(JSON.stringify({ error: 'You already have a list with that name' }), { status: 409 });
    }
    throw err;
  }
};

export const DELETE: APIRoute = ({ params, locals }) => {
  const userId = locals.user!.id;
  const listId = parseInt(params.id ?? '', 10);

  if (isNaN(listId)) {
    return new Response(JSON.stringify({ error: 'Invalid list ID' }), { status: 400 });
  }

  const list = getListById(listId, userId);
  if (!list) {
    return new Response(JSON.stringify({ error: 'List not found' }), { status: 404 });
  }

  deleteList(listId, userId);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
