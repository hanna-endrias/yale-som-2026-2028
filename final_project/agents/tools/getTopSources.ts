import { tool } from 'ai';
import { count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { mentions } from '@/db/schema';

// Sources ranked by mention count for one subject (subjectId fixed server-side).
export function getTopSourcesTool(subjectId: number) {
  return tool({
    description: 'Rank the sources (sites) that mention the subject most, with mention counts.',
    inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(5) }),
    execute: async ({ limit }) =>
      getDb()
        .select({ source: mentions.source, mentions: count() })
        .from(mentions)
        .where(eq(mentions.subjectId, subjectId))
        .groupBy(mentions.source)
        .orderBy(desc(count()))
        .limit(limit)
        .all(),
  });
}
