import type { APIRoute } from 'astro';
import {
  createUser,
  createSession,
  getUserByEmail,
  getUserByUsername,
  initUserStats,
} from '../../../lib/db.js';
import { hashPassword, generateSessionToken } from '../../../lib/auth.js';

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { username?: string; email?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { username, email, password } = body;

  if (!username || !email || !password) {
    return new Response(JSON.stringify({ error: 'All fields are required' }), { status: 400 });
  }

  if (username.length < 2 || username.length > 32) {
    return new Response(JSON.stringify({ error: 'Username must be 2–32 characters' }), { status: 400 });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), { status: 400 });
  }

  if (getUserByEmail(email)) {
    return new Response(JSON.stringify({ error: 'Email already in use' }), { status: 409 });
  }

  if (getUserByUsername(username)) {
    return new Response(JSON.stringify({ error: 'Username already taken' }), { status: 409 });
  }

  const user = createUser(username, email.toLowerCase(), hashPassword(password));
  initUserStats(user.id);

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
