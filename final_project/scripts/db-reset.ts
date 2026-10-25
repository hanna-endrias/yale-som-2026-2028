import { rmSync } from 'node:fs';
import { dbPath } from '@/config/db';

// Stop the dev server first: it holds the DB open.
export function resetDb(): void {
  for (const suffix of ['', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true });
  console.log(`Deleted ${dbPath}`);
}

if (process.argv[1]?.endsWith('db-reset.ts')) resetDb();
