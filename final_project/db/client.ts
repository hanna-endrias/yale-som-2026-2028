import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { dbPath } from '@/config/db';
import * as schema from './schema';
import { seed } from './seed';

export type Db = BetterSQLite3Database<typeof schema>;

function open(): Db {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'db/migrations') });
  // Self-healing: a missing or empty DB gets seeded; an existing one is used as is.
  if (!db.select({ id: schema.users.id }).from(schema.users).limit(1).get()) seed(db);
  return db;
}

// Cached on globalThis so Next.js hot reloads reuse the same connection.
const g = globalThis as unknown as { __db?: Db };
export function getDb(): Db {
  return (g.__db ??= open());
}
