import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';
import { SESSION_COOKIE, readSessionToken } from './auth';

export type CurrentUser = { id: number; email: string };

// For server components and routes: the logged-in user, or null.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (userId === null) return null;
  const user = getDb().select({ id: users.id, email: users.email }).from(users).where(eq(users.id, userId)).get();
  return user ?? null;
}

// For routes: the logged-in user, or a 401 response to return as is.
export async function requireUser(): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  return user ?? NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
}
