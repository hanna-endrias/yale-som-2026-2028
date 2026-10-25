import { tool } from 'ai';
import { and, count, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { mentions } from '@/db/schema';

// Mention counts per day and sentiment for one subject (subjectId fixed server-side).
export function getSentimentSummaryTool(subjectId: number) {
  return tool({
    description: 'Count mentions per day by sentiment (positive/neutral/negative), optionally within a date range.',
    inputSchema: z.object({
      since: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      until: z.string().optional().describe('YYYY-MM-DD, inclusive'),
    }),
    execute: async ({ since, until }) => {
      const rows = getDb()
        .select({ date: mentions.publishedAt, sentiment: mentions.sentiment, count: count() })
        .from(mentions)
        .where(
          and(
            eq(mentions.subjectId, subjectId),
            since ? gte(mentions.publishedAt, since) : undefined,
            until ? lte(mentions.publishedAt, until) : undefined,
          ),
        )
        .groupBy(mentions.publishedAt, mentions.sentiment)
        .orderBy(mentions.publishedAt)
        .all();

      const byDay: Record<string, { positive: number; neutral: number; negative: number }> = {};
      const totals = { positive: 0, neutral: 0, negative: 0 };
      for (const r of rows) {
        byDay[r.date] ??= { positive: 0, neutral: 0, negative: 0 };
        byDay[r.date][r.sentiment] += r.count;
        totals[r.sentiment] += r.count;
      }
      return { totals, byDay };
    },
  });
}
