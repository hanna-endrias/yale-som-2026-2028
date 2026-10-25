import { tool } from 'ai';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { mentions } from '@/db/schema';

// subjectId is fixed server-side; the model can only filter within that subject.
export function getMentionsTool(subjectId: number) {
  return tool({
    description: 'List stored mentions (newest first), optionally filtered by sentiment, source and date range.',
    inputSchema: z.object({
      sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
      source: z.string().optional().describe('e.g. "yelp.com"'),
      since: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      until: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    execute: async ({ sentiment, source, since, until, limit }) =>
      getDb()
        .select({
          source: mentions.source,
          url: mentions.url,
          publishedAt: mentions.publishedAt,
          sentiment: mentions.sentiment,
          snippet: mentions.snippet,
        })
        .from(mentions)
        .where(
          and(
            eq(mentions.subjectId, subjectId),
            sentiment ? eq(mentions.sentiment, sentiment) : undefined,
            source ? eq(mentions.source, source) : undefined,
            since ? gte(mentions.publishedAt, since) : undefined,
            until ? lte(mentions.publishedAt, until) : undefined,
          ),
        )
        .orderBy(desc(mentions.publishedAt))
        .limit(limit)
        .all(),
  });
}
