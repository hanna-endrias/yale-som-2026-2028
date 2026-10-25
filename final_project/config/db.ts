import path from 'node:path';
import { getEnvVar } from '@/lib/env';

// SQLite file location: DATABASE_PATH from .env, else data/perspectives.db.
// Relative paths resolve from final_project/.
export const dbPath = path.resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  getEnvVar('DATABASE_PATH').value ?? 'data/perspectives.db',
);
