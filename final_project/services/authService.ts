import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';
import { hashPassword, verifyPassword } from '@/lib/auth';
import type { CurrentUser } from '@/lib/session';
import { seedDefaultPrompts } from './promptService';

type AuthResult = { user: CurrentUser } | { error: string };

export function signup(email: string, password: string): AuthResult {
  const db = getDb();
  if (db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()) {
    return { error: 'An account with this email already exists.' };
  }
  const user = db.transaction((tx) => {
    const row = tx
      .insert(users)
      .values({ email, passwordHash: hashPassword(password) })
      .returning({ id: users.id, email: users.email })
      .get();
    seedDefaultPrompts(tx, row.id);
    return row;
  });
  return { user };
}

export function login(email: string, password: string): AuthResult {
  const user = getDb().select().from(users).where(eq(users.email, email)).get();
  if (!user || !verifyPassword(password, user.passwordHash)) return { error: 'Wrong email or password.' };
  return { user: { id: user.id, email: user.email } };
}
