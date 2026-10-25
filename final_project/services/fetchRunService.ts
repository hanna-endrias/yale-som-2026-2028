import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { runCadence, splitWindows } from '@/agents/cadenceWrapper';
import { intersectRange, subtractRanges } from '@/lib/dateRanges';
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

// No-overlap rule: a date is covered when a done/pending/running run of the subject includes it with the same
// (trimmed) instructions. Returns the uncovered gaps and what was skipped (per covering run); null if not owned.
export function planFetchRun(ownerId: number, subjectId: number, input: CreateFetchRunInput) {
  if (!getSubject(ownerId, subjectId)) return null;
  const instructions = (input.instructions ?? '').trim();
  const range = { start: input.startDate, end: input.endDate };
  const covering = getDb()
    .select({ id: fetchRuns.id, start: fetchRuns.startDate, end: fetchRuns.endDate, status: fetchRuns.status, instructions: fetchRuns.instructions })
    .from(fetchRuns)
    .where(and(eq(fetchRuns.subjectId, subjectId), inArray(fetchRuns.status, ['done', 'pending', 'running'])))
    .orderBy(asc(fetchRuns.startDate))
    .all()
    .filter((r) => (r.instructions ?? '').trim() === instructions);
  const skipped = covering.flatMap((r) => {
    const overlap = intersectRange(range, r);
    return overlap ? [{ ...overlap, runId: r.id, status: r.status }] : [];
  });
  const gaps = subtractRanges(range, covering).map((g) => ({ ...g, windows: splitWindows(g.start, g.end, input.cadence).length }));
  return { gaps, skipped, totalWindows: gaps.reduce((n, g) => n + g.windows, 0), instructions: instructions || null };
}

// Inserts one pending run per uncovered gap and runs them in-process, one after another, without awaiting.
// Returns null if not owned, { covered } when every date is already fetched, else { runs, skipped }.
export function startFetchRun(ownerId: number, subjectId: number, input: CreateFetchRunInput) {
  const subject = getSubject(ownerId, subjectId);
  const plan = subject && planFetchRun(ownerId, subjectId, input);
  if (!subject || !plan) return null;
  if (!plan.gaps.length) return { covered: plan.skipped };
  const db = getDb();
  const runs = plan.gaps.map((g) => ({
    ...db.insert(fetchRuns).values({ subjectId, ...input, startDate: g.start, endDate: g.end }).returning().get(),
    windows: g.windows,
  }));
  void (async () => {
    for (const run of runs) await runJob(run.id, subject, { ...input, startDate: run.startDate, endDate: run.endDate });
  })();
  return { runs, skipped: plan.skipped };
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
        // fetchWindow already returns the stored column shape (themes joined, out-of-window dates dropped).
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
