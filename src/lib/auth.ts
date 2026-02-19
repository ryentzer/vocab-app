import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function makeSessionCookie(token: string): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  return `session_token=${token}; HttpOnly; Path=/; SameSite=Lax; Expires=${expires.toUTCString()}`;
}

export function clearSessionCookie(): string {
  return `session_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}
