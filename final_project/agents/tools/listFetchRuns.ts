import { tool } from 'ai';
import { z } from 'zod';
import { listFetchRuns } from '@/services/fetchRunService';

// The subject's fetch run history, newest first (owner and subject fixed server-side).
export function listFetchRunsTool(ownerId: number, subjectId: number) {
  return tool({
    description:
      'List the fetch runs (run history) of this tracker, newest first: dates, cadence, status, mention count, search criteria and cost.',
    inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
    execute: async ({ limit }) =>
      (listFetchRuns(ownerId, subjectId) ?? []).slice(0, limit).map(({ createdAt: _c, instructions, ...r }) => ({
        ...r,
        // The rendered search criteria the run used (null = none).
        searchCriteria: instructions && instructions.length > 200 ? `${instructions.slice(0, 200)}…` : instructions,
      })),
  });
}
