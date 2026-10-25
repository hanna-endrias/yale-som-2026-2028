import { tool } from 'ai';
import { z } from 'zod';
import { listFetchRuns } from '@/services/fetchRunService';

// The subject's fetch run history, newest first (owner and subject fixed server-side).
export function listFetchRunsTool(ownerId: number, subjectId: number) {
  return tool({
    description:
      'List the fetch runs (run history) of this subject, newest first: dates, cadence, status, mention count, fetch prompt and cost.',
    inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
    execute: async ({ limit }) =>
      (listFetchRuns(ownerId, subjectId) ?? []).slice(0, limit).map(({ createdAt: _c, ...r }) => ({
        ...r,
        instructions: r.instructions && r.instructions.length > 200 ? `${r.instructions.slice(0, 200)}…` : r.instructions,
      })),
  });
}
