import type { APIRoute } from 'astro';
import { deleteSession } from '../../../lib/db.js';

export const POST: APIRoute = ({ cookies }) => {
  const token = cookies.get('session_token')?.value;
  if (token) {
    deleteSession(token);
  }
  cookies.delete('session_token', { path: '/' });
  return new Response(null, {
    status: 302,
    headers: { Location: '/login' },
  });
};
