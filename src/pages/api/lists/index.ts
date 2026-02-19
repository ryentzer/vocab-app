import type { APIRoute } from 'astro';
import { getLists, createList } from '../../../lib/db.js';

export const GET: APIRoute = ({ locals }) => {
  const userId = locals.user!.id;
  const lists = getLists(userId);
  return new Response(JSON.stringify(lists), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = locals.user!.id;
  let body: { name?: string; description?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { name, description } = body;

  if (!name || name.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400 });
  }

  if (name.trim().length > 64) {
    return new Response(JSON.stringify({ error: 'Name must be 64 characters or fewer' }), { status: 400 });
  }

  try {
    const list = createList(userId, name.trim(), description?.trim());
    return new Response(JSON.stringify(list), {
      status: 201,
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
