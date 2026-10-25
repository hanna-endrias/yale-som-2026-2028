import { NextResponse } from 'next/server';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/auth';
import { login } from '@/services/authService';
import { parseLoginRequest } from './request';

export async function POST(req: Request) {
  const parsed = await parseLoginRequest(req);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = login(parsed.data.email, parsed.data.password);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(result.user.id), sessionCookieOptions);
  return res;
}
