import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

export type ResolvedKey = { key: string; source: string };

// The key comes only from final_project/.env. The file is read directly and process.env
// is ignored on purpose: Next.js never overrides a variable already set in the shell, so
// a shell PORTKEY_API_KEY would otherwise silently win over the .env file.
export function getPortkeyKey(): ResolvedKey {
  const file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), '.env');
  const key = existsSync(file) ? parse(readFileSync(file)).PORTKEY_API_KEY : undefined;
  if (!key) throw new Error(`PORTKEY_API_KEY is missing. Add it to ${file}`);
  return { key, source: file };
}
