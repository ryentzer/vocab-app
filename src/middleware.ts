import { defineMiddleware } from 'astro:middleware';
import { getSessionByToken } from './lib/db.js';

const PUBLIC_PAGES = new Set(['/login', '/register']);

export const onRequest = defineMiddleware(async (context, next) => {
  const token = context.cookies.get('session_token')?.value;

  let user: App.Locals['user'] = null;
  if (token) {
    const session = getSessionByToken(token);
    if (session) {
      user = {
        id: session.user.id,
        username: session.user.username,
        email: session.user.email,
        created_at: session.user.created_at,
      };
    }
  }

  context.locals.user = user;

  const { pathname } = new URL(context.request.url);

  // Logged-in user visiting auth pages → redirect to home
  if (user && PUBLIC_PAGES.has(pathname)) {
    return context.redirect('/');
  }

  // Unauthenticated access handling
  if (!user && !PUBLIC_PAGES.has(pathname)) {
    if (pathname.startsWith('/api/')) {
      // API routes under /api/auth/ are public
      if (!pathname.startsWith('/api/auth/')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      return context.redirect('/login');
    }
  }

  return next();
});
