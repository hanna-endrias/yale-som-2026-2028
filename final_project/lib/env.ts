import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

export type ResolvedKey = { key: string; source: string };

// Values come only from final_project/.env. The file is read directly and process.env
// is ignored on purpose: Next.js never overrides a variable already set in the shell, so
// a shell variable would otherwise silently win over the .env file.
export function getEnvVar(name: string): { value: string | undefined; source: string } {
  const file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), '.env');
  const value = existsSync(file) ? parse(readFileSync(file))[name] : undefined;
  return { value: value || undefined, source: file };
}

export function getApiKey(envVar: string): ResolvedKey {
  const { value, source } = getEnvVar(envVar);
  if (!value) throw new Error(`${envVar} is missing. Add it to ${source}`);
  return { key: value, source };
}
