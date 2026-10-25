import { desc, eq, sql } from 'drizzle-orm';
import { runCadence } from '@/agents/cadenceWrapper';
import { getDb } from '@/db/client';
import { fetchRuns, mentions, tokenUsage } from '@/db/schema';
import { usageRow } from '@/lib/cost';
import type { CreateFetchRunInput } from '@/lib/validation/fetchRuns';
import { getSubject } from './subjectService';

// Fetch runs of an owned subject (newest first) with their mention counts; null if not owned.
export function listFetchRuns(ownerId: number, subjectId: number) {
  if (!getSubject(ownerId, subjectId)) return null;
  return getDb()
    .select({
      id: fetchRuns.id,
      startDate: fetchRuns.startDate,
      endDate: fetchRuns.endDate,
      cadence: fetchRuns.cadence,
      status: fetchRuns.status,
      error: fetchRuns.error,
      instructions: fetchRuns.instructions,
      createdAt: fetchRuns.createdAt,
      mentionCount: sql<number>`(select count(*) from mentions where mentions.fetch_run_id = fetch_runs.id)`,
      // Summed over the run's windows.
      tokens: sql<number>`(select coalesce(sum(input_tokens + output_tokens), 0) from token_usage where scope = 'fetch_run' and ref_id = fetch_runs.id)`,
      costUsd: sql<number>`(select coalesce(sum(estimated_cost_usd), 0) from token_usage where scope = 'fetch_run' and ref_id = fetch_runs.id)`,
    })
    .from(fetchRuns)
    .where(eq(fetchRuns.subjectId, subjectId))
    .orderBy(desc(fetchRuns.id))
    .all();
}

// Inserts a pending run and starts the job in-process without awaiting it.
export function startFetchRun(ownerId: number, subjectId: number, input: CreateFetchRunInput) {
  const subject = getSubject(ownerId, subjectId);
  if (!subject) return null;
  const run = getDb().insert(fetchRuns).values({ subjectId, ...input }).returning().get();
  void runJob(run.id, subject, input);
  return run;
}

async function runJob(runId: number, subject: NonNullable<ReturnType<typeof getSubject>>, input: CreateFetchRunInput) {
  const db = getDb();
  const setStatus = (status: 'running' | 'done' | 'failed', error: string | null = null) =>
    db.update(fetchRuns).set({ status, error }).where(eq(fetchRuns.id, runId)).run();

  setStatus('running');
  try {
    // Each window's mentions and token usage are saved as soon as that window finishes.
    await runCadence(subject, input, ({ mentions: found, usage }) => {
      db.transaction((tx) => {
        if (found.length) {
          tx.insert(mentions).values(found.map((m) => ({ ...m, subjectId: subject.id, fetchRunId: runId }))).run();
        }
        tx.insert(tokenUsage).values({ scope: 'fetch_run', refId: runId, ...usageRow(usage) }).run();
      });
    });
    setStatus('done');
  } catch (err) {
    console.error(`Fetch run ${runId} failed:`, err);
    setStatus('failed', err instanceof Error ? err.message : 'The fetch failed.');
  }
}
