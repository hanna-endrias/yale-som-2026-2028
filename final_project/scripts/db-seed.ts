import { count, getTableName } from 'drizzle-orm';
import { getDb } from '@/db/client';
import * as schema from '@/db/schema';
import { resetDb } from './db-reset';

resetDb();
const db = getDb(); // opening an empty DB migrates and auto-seeds it
for (const table of Object.values(schema)) {
  const row = db.select({ n: count() }).from(table).get();
  console.log(`${getTableName(table).padEnd(14)} ${row?.n}`);
}
