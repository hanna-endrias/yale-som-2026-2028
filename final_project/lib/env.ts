import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

export type ResolvedKey = { key: string; source: string };

// .env files, in lookup order: final_project/ itself, the repo root, then the folder above the
// repo (where the teaching staff keep theirs: submissions/.env next to the cloned repo). Each
// variable comes from the first file that sets it. process.env is ignored on purpose: Next.js
// never overrides a variable already set in the shell, so a shell variable would otherwise
// silently win over the .env file.
const ENV_FILES = ['.env', '../.env', '../../.env'].map((p) => path.resolve(/*turbopackIgnore: true*/ process.cwd(), p));

export function getEnvVar(name: string): { value: string | undefined; source: string } {
  for (const file of ENV_FILES) {
    const value = existsSync(file) ? parse(readFileSync(file))[name] : undefined;
    if (value) return { value, source: file };
  }
  return { value: undefined, source: `${ENV_FILES[0]} (or a .env up to two folders above it)` };
}

export function getApiKey(envVar: string): ResolvedKey {
  const { value, source } = getEnvVar(envVar);
  if (!value) throw new Error(`${envVar} is missing. Add it to ${source}`);
  return { key: value, source };
}
