import type { APIRoute } from 'astro';
import { getUserByEmail, createSession } from '../../../lib/db.js';
import { verifyPassword, generateSessionToken } from '../../../lib/auth.js';

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { email?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { email, password } = body;

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400 });
  }

  const user = getUserByEmail(email);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401 });
  }

  const token = generateSessionToken();
  createSession(user.id, token);

  cookies.set('session_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
