import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getEnvVar } from './env';

// Passwords: scrypt, stored as "salt:hash" (hex).
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

// Session cookie: base64url({userId, exp}) + "." + HMAC-SHA256 signature.
export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE,
};

const DEV_SECRET = 'dev-only-insecure-session-secret';
let warned = false;

function getSecret(): string {
  const { value, source } = getEnvVar('SESSION_SECRET');
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error(`SESSION_SECRET is missing. Add it to ${source}`);
  if (!warned) console.warn(`⚠ SESSION_SECRET is missing from ${source}. Using an insecure dev-only secret.`);
  warned = true;
  return DEV_SECRET;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createSessionToken(userId: number): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = Buffer.from(JSON.stringify({ userId, exp })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

// Returns the userId if the token is correctly signed and not expired.
export function readSessionToken(token: string | undefined): number | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const { userId, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof userId !== 'number' || typeof exp !== 'number' || exp < Date.now() / 1000) return null;
    return userId;
  } catch {
    return null;
  }
}
